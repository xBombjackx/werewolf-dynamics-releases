// wd-plugin-host.js — browser JUCE host shim, AudioWorklet lifecycle, presets,
// ModSys state, FFT binning, and binary telemetry pump driven by __WD_PLUGIN_SPEC__.
(() => {
  'use strict';

  const SPEC = window.__WD_PLUGIN_SPEC__;
  if (!SPEC) return;

  // ----------------------------------------------------------------- schema
  const params = Array.isArray(SPEC.params) ? SPEC.params : [];
  const paramById = new Map();
  params.forEach((p, idx) => paramById.set(p.id, { ...p, idx }));

  const skewOf = p => {
    if (typeof p.skew === 'number' && p.skew > 0) return p.skew;
    if (typeof p.center === 'number' && p.max > p.min)
      return Math.log(0.5) / Math.log((p.center - p.min) / (p.max - p.min));
    return 1;
  };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const normToPlain = (p, norm) => {
    const n = clamp(norm, 0, 1);
    const s = skewOf(p);
    const lin = (s !== 1 && n > 0) ? Math.exp(Math.log(n) / s) : n;
    let val = p.min + (p.max - p.min) * lin;
    if (p.interval && p.interval > 0)
      val = clamp(p.min + p.interval * Math.round((val - p.min) / p.interval), p.min, p.max);
    return val;
  };
  const plainToNorm = (p, plain) => {
    let v = clamp(plain, p.min, p.max);
    if (p.interval && p.interval > 0)
      v = clamp(p.min + p.interval * Math.round((v - p.min) / p.interval), p.min, p.max);
    const span = p.max - p.min;
    const lin = span > 0 ? clamp((v - p.min) / span, 0, 1) : 0;
    const s = skewOf(p);
    return (s !== 1 && lin > 0) ? Math.pow(lin, s) : lin;
  };

  function defaultNormFor(p) {
    if (p.kind === 'toggle') return !!p.def;
    if (p.kind === 'combo') {
      const n = p.choices ? p.choices.length : 1;
      return n > 1 ? clamp((p.def || 0) / (n - 1), 0, 1) : 0;
    }
    return plainToNorm(p, typeof p.def === 'number' ? p.def : p.min);
  }

  // Normalized (or boolean) store + per-control listeners
  const values = new Map();
  for (const p of params) values.set(p.id, defaultNormFor(p));

  const paramListeners = new Map();
  let nextTok = 1;
  const fireParam = id => {
    const m = paramListeners.get(id);
    if (!m) return;
    for (const cb of m.values()) cb();
  };
  const addParamListener = (id, cb) => {
    if (!paramListeners.has(id)) paramListeners.set(id, new Map());
    const t = nextTok++;
    paramListeners.get(id).set(t, cb);
    return t;
  };
  const removeParamListener = (id, tok) => {
    const m = paramListeners.get(id);
    if (m) m.delete(tok);
  };

  // Event bus (window.__JUCE__.backend)
  const eventListeners = new Map();
  const emit = (name, payload) => {
    const arr = eventListeners.get(name);
    if (!arr) return;
    for (const cb of arr.slice()) {
      try { cb(payload); } catch {}
    }
  };
  window.__JUCE__ = {
    backend: {
      addEventListener(name, cb) {
        if (!eventListeners.has(name)) eventListeners.set(name, []);
        eventListeners.get(name).push(cb);
        return { id: name, fn: cb };
      },
      removeEventListener(handle) {
        if (!handle || !handle.id) return;
        const arr = eventListeners.get(handle.id);
        if (!arr) return;
        const i = arr.indexOf(handle.fn);
        if (i >= 0) arr.splice(i, 1);
      },
    },
  };

  // ----------------------------------------------------------------- ModSys
  const modState = {
    slots: Array.from({ length: 24 }, (_, index) => ({ index, source: -1, dest: -1, curve: 0, on: false })),
    xlfos: Array.from({ length: 3 }, (_, index) => ({
      index,
      numSteps: 4,
      isSynced: true,
      syncRateBeats: 1.0,
      retriggerMode: 0,
      steps: Array.from({ length: 32 }, (_, s) => ({
        index: s,
        value: s % 2 === 0 ? 0.8 : -0.8,
        glide: 100.0,
        slope: 0.0,
      })),
    })),
    followerExtSc: false,
  };
  function syncModToWorklet() {
    if (audio.node) audio.node.port.postMessage({ type: 'modState', ...modState });
  }

  // ---------------------------------------------------------------- Presets
  const factoryPresets = Array.isArray(SPEC.presets) ? SPEC.presets : [];
  const userPresets = new Map();
  const locks = new Set();
  const slots = [null, null, null, null];
  const undoStack = [];
  const redoStack = [];
  let activeSlot = 0;
  let morphX = 0;
  let morphY = 0;
  let morphActive = false;
  let currentPreset = 'Init';
  let gestureStart = null;
  let gestureDepth = 0;

  const captureSnap = () => {
    const m = {};
    for (const p of params) m[p.id] = values.get(p.id);
    return m;
  };
  const snapsDiffer = (a, b) => {
    if (!a || !b) return true;
    for (const p of params) {
      if (a[p.id] !== b[p.id]) return true;
    }
    return false;
  };
  slots[0] = captureSnap();
  slots[1] = captureSnap();
  slots[2] = captureSnap();
  slots[3] = captureSnap();

  function applySnap(snap, respectLocks = true) {
    for (const p of params) {
      if (p.id === 'power') continue;
      if (respectLocks && locks.has(p.id)) continue;
      if (!(p.id in snap)) continue;
      if (values.get(p.id) !== snap[p.id]) {
        values.set(p.id, snap[p.id]);
        fireParam(p.id);
      }
    }
    slots[activeSlot] = captureSnap();
    scheduleSync();
  }

  function pushUndo(snap) {
    if (undoStack.length && !snapsDiffer(undoStack[undoStack.length - 1], snap)) return;
    undoStack.push(snap);
    if (undoStack.length > 40) undoStack.shift();
    redoStack.length = 0;
  }

  function buildPresetState() {
    const list = [{ name: 'Init', factory: true }];
    for (const fp of factoryPresets) list.push({ name: fp.name, factory: true });
    for (const up of userPresets.keys()) list.push({ name: up, factory: false });
    return {
      presets: list,
      currentPreset,
      activeSlot,
      morphX,
      morphY,
      locks: Array.from(locks),
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
    };
  }

  function loadPreset(name) {
    const prev = captureSnap();
    if (name === 'Init') {
      pushUndo(prev);
      const target = {};
      for (const p of params) target[p.id] = defaultNormFor(p);
      currentPreset = 'Init';
      applySnap(target, true);
      return true;
    }
    const fp = factoryPresets.find(f => f.name === name);
    if (fp) {
      pushUndo(prev);
      const target = {};
      for (const p of params) target[p.id] = defaultNormFor(p);
      for (const [pid, plainVal] of Object.entries(fp.values || {})) {
        const p = paramById.get(pid);
        if (!p) continue;
        if (p.kind === 'toggle') target[pid] = !!plainVal;
        else if (p.kind === 'combo') {
          const n = p.choices ? p.choices.length : 1;
          target[pid] = n > 1 ? clamp(plainVal / (n - 1), 0, 1) : 0;
        } else {
          target[pid] = plainToNorm(p, plainVal);
        }
      }
      currentPreset = name;
      applySnap(target, true);
      return true;
    }
    if (userPresets.has(name)) {
      pushUndo(prev);
      currentPreset = name;
      applySnap(userPresets.get(name), true);
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------- settings
  const settings = { theme: 'studio', uiScale: 1.0, tooltips: true };

  // --------------------------------------------------------- JUCE relays
  const sliderStates = {};
  const comboStates = {};
  const toggleStates = {};

  function getPlain(id) {
    const p = paramById.get(id);
    if (!p) return 0;
    const v = values.get(id);
    if (p.kind === 'toggle') return v ? 1 : 0;
    if (p.kind === 'combo') {
      const n = p.choices ? p.choices.length : 1;
      return n > 1 ? Math.round(clamp(v || 0, 0, 1) * (n - 1)) : 0;
    }
    return normToPlain(p, v);
  }

  function setPlain(id, plain) {
    const p = paramById.get(id);
    if (!p) return;
    let next;
    if (p.kind === 'toggle') next = !!plain;
    else if (p.kind === 'combo') {
      const n = p.choices ? p.choices.length : 1;
      next = n > 1 ? clamp(Math.round(plain) / (n - 1), 0, 1) : 0;
    } else {
      next = plainToNorm(p, plain);
    }
    if (values.get(id) !== next) {
      values.set(id, next);
      fireParam(id);
      scheduleSync();
    }
  }

  // Binary telemetry subscribers (used by kit.js createTelemetryPoller)
  const telemetryListeners = new Set();
  function pushTelemetry(kind, flags, floats, seq) {
    const f32 = floats instanceof Float32Array ? floats : new Float32Array(floats);
    const pkt = { kind, flags: flags >>> 0, seq: (seq || 1) >>> 0, floats: f32 };
    for (const fn of telemetryListeners) {
      try { fn(pkt); } catch {}
    }
  }

  const wasmUi = { wasm: null, fs: 48000 };
  const audio = {
    ctx: null, node: null, master: null, source: null,
    preAn: null, postAn: null, auxAn: null,
    postAnL: null, postAnR: null,
    playing: false,
  };

  const hostCtx = {
    getPlain,
    setPlain,
    emit,
    pushTelemetry,
    sendAction(actionId, value = 0) {
      if (audio.node) audio.node.port.postMessage({ type: 'action', actionId, value });
      if (wasmUi.wasm) {
        wasmUi.wasm.wd_action(actionId, value);
        wasmUi.wasm.wd_apply();
      }
    },
    getSampleRate: () => (audio.ctx ? audio.ctx.sampleRate : wasmUi.fs),
    getModState: () => modState,
    params,
    wasmUi,
    audio,
    latestWasmMeters: [],
    computeSpecBins: null,
  };

  const host = {
    sliderState(id) {
      if (!sliderStates[id]) {
        const p = paramById.get(id) || { id, kind: 'slider', min: 0, max: 1, def: 0, interval: 0, skew: 1 };
        if (!values.has(id)) values.set(id, defaultNormFor(p));
        const defVal = typeof p.def === 'number' ? p.def : p.min;
        sliderStates[id] = {
          properties: {
            start: p.min,
            end: p.max,
            skew: skewOf(p),
            defaultValue: defVal,
            name: p.name || id,
            label: p.label || '',
            interval: p.interval || 0,
            numSteps: p.numSteps || 1000,
          },
          getNormalisedValue: () => values.get(id),
          getScaledValue: () => normToPlain(p, values.get(id)),
          setNormalisedValue: v => {
            v = clamp(v, 0, 1);
            if (p.interval && p.interval > 0) v = plainToNorm(p, normToPlain(p, v));
            if (values.get(id) === v) return;
            values.set(id, v);
            slots[activeSlot] = captureSnap();
            fireParam(id);
            scheduleSync();
          },
          sliderDragStarted: () => {
            if (gestureDepth++ === 0) gestureStart = captureSnap();
          },
          sliderDragEnded: () => {
            if (gestureDepth > 0 && --gestureDepth === 0) {
              const nowSnap = captureSnap();
              if (gestureStart && snapsDiffer(gestureStart, nowSnap)) pushUndo(gestureStart);
              gestureStart = null;
              slots[activeSlot] = nowSnap;
            }
          },
          valueChangedEvent: {
            addListener: cb => addParamListener(id, cb),
            removeListener: tok => removeParamListener(id, tok),
          },
          propertiesChangedEvent: { addListener: () => 0, removeListener: () => {} },
        };
      }
      return sliderStates[id];
    },
    comboState(id) {
      if (!comboStates[id]) {
        const p = paramById.get(id) || { id, kind: 'combo', choices: ['Default'], def: 0 };
        if (!values.has(id)) values.set(id, defaultNormFor(p));
        const choices = Array.isArray(p.choices) ? p.choices : [];
        comboStates[id] = {
          properties: { name: id, parameterIndex: p.idx ?? 0, choices },
          get value() { return values.get(id); },
          getChoiceIndex() {
            return choices.length > 1 ? Math.round((values.get(id) || 0) * (choices.length - 1)) : 0;
          },
          setChoiceIndex: i => {
            const n = choices.length;
            const v = n > 1 ? clamp(Math.round(i) / (n - 1), 0, 1) : 0;
            if (values.get(id) === v) return;
            pushUndo(captureSnap());
            values.set(id, v);
            slots[activeSlot] = captureSnap();
            fireParam(id);
            scheduleSync();
          },
          valueChangedEvent: {
            addListener: cb => addParamListener(id, cb),
            removeListener: tok => removeParamListener(id, tok),
          },
          propertiesChangedEvent: { addListener: () => 0, removeListener: () => {} },
        };
      }
      return comboStates[id];
    },
    toggleState(id) {
      if (!toggleStates[id]) {
        const p = paramById.get(id) || { id, kind: 'toggle', def: false };
        if (!values.has(id)) values.set(id, !!p.def);
        toggleStates[id] = {
          properties: { name: id, parameterIndex: p.idx ?? 0 },
          getValue: () => !!values.get(id),
          setValue: v => {
            v = !!v;
            if (!!values.get(id) === v) return;
            pushUndo(captureSnap());
            values.set(id, v);
            slots[activeSlot] = captureSnap();
            fireParam(id);
            scheduleSync();
          },
          valueChangedEvent: {
            addListener: cb => addParamListener(id, cb),
            removeListener: tok => removeParamListener(id, tok),
          },
          propertiesChangedEvent: { addListener: () => 0, removeListener: () => {} },
        };
      }
      return toggleStates[id];
    },
    createTelemetryPoller(onPacket) {
      let active = false;
      return {
        start() {
          if (active) return;
          active = true;
          telemetryListeners.add(onPacket);
        },
        stop() {
          active = false;
          telemetryListeners.delete(onPacket);
        },
      };
    },
    nativeFunction(name) {
      if (SPEC.nativeFunctions && typeof SPEC.nativeFunctions[name] === 'function')
        return (...args) => SPEC.nativeFunctions[name](hostCtx, ...args);

      if (name === 'getUiState') {
        return async () => ({
          build: 'web demo · wasm core',
          sampleRate: audio.ctx ? audio.ctx.sampleRate : 48000,
          bpm: 120,
          selfName: SPEC.title || SPEC.slug,
          selfCustomName: '',
          beaconPublishedName: '',
          beaconPublishing: false,
          beaconSource: '',
          beaconReceiving: false,
          beaconSrMismatch: false,
          beaconSources: [],
          ...(SPEC.extraUiState ? SPEC.extraUiState(hostCtx) : {}),
        });
      }
      if (name === 'wdGetGlobalSettings') return async () => ({ ...settings });
      if (name === 'wdSetGlobalSetting') {
        return async (k, v) => {
          if (k === 'theme' || k === 'uiScale' || k === 'tooltips') settings[k] = v;
          return { ...settings };
        };
      }
      if (name === 'wdGetPresetState') return async () => buildPresetState();
      if (name === 'wdLoadPreset') return async n => ({ ok: loadPreset(n), state: buildPresetState() });
      if (name === 'wdSavePreset') {
        return async n => {
          const clean = String(n || '').trim();
          if (!clean || clean === 'Init' || factoryPresets.some(f => f.name.toLowerCase() === clean.toLowerCase()))
            return { ok: false, state: buildPresetState() };
          userPresets.set(clean, captureSnap());
          currentPreset = clean;
          return { ok: true, state: buildPresetState() };
        };
      }
      if (name === 'wdDeletePreset') {
        return async n => {
          const ok = userPresets.delete(n);
          if (ok && currentPreset === n) currentPreset = 'Init';
          return { ok, state: buildPresetState() };
        };
      }
      if (name === 'wdSelectSlot') {
        return async idx => {
          slots[activeSlot] = captureSnap();
          activeSlot = clamp(idx | 0, 0, 3);
          if (slots[activeSlot]) applySnap(slots[activeSlot], false);
          return { ok: true, state: buildPresetState() };
        };
      }
      if (name === 'wdCopySlot') {
        return async idx => {
          slots[clamp(idx | 0, 0, 3)] = captureSnap();
          return { ok: true, state: buildPresetState() };
        };
      }
      if (name === 'wdSetMorphXY') {
        return async (x, y, hold) => {
          morphX = clamp(Number(x) || 0, 0, 1);
          morphY = clamp(Number(y) || 0, 0, 1);
          if (!morphActive && hold) {
            morphActive = true;
            pushUndo(captureSnap());
          } else if (!hold) {
            pushUndo(captureSnap());
          }
          const wA = (1 - morphX) * (1 - morphY);
          const wB = morphX * (1 - morphY);
          const wC = (1 - morphX) * morphY;
          const wD = morphX * morphY;
          const weights = [wA, wB, wC, wD];
          const dom = weights.indexOf(Math.max(...weights));
          const morphed = {};
          for (const p of params) {
            const getC = idx => (slots[idx] && p.id in slots[idx]) ? slots[idx][p.id] : values.get(p.id);
            if (p.kind === 'toggle' || p.kind === 'combo') morphed[p.id] = getC(dom);
            else morphed[p.id] = clamp(wA * getC(0) + wB * getC(1) + wC * getC(2) + wD * getC(3), 0, 1);
          }
          applySnap(morphed, true);
          return {};
        };
      }
      if (name === 'wdEndMorphXY') {
        return async () => { morphActive = false; return { ok: true, state: buildPresetState() }; };
      }
      if (name === 'wdSetParamLock') {
        return async (pid, locked) => {
          if (locked) locks.add(pid); else locks.delete(pid);
          return { ok: true, state: buildPresetState() };
        };
      }
      if (name === 'wdClearLocks') return async () => { locks.clear(); return { ok: true, state: buildPresetState() }; };
      if (name === 'wdUndo') {
        return async () => {
          if (!undoStack.length) return { ok: false, state: buildPresetState() };
          redoStack.push(captureSnap());
          applySnap(undoStack.pop(), false);
          return { ok: true, state: buildPresetState() };
        };
      }
      if (name === 'wdRedo') {
        return async () => {
          if (!redoStack.length) return { ok: false, state: buildPresetState() };
          undoStack.push(captureSnap());
          applySnap(redoStack.pop(), false);
          return { ok: true, state: buildPresetState() };
        };
      }
      if (name === 'getModState') return async () => modState;
      if (name === 'setSlotConfig') {
        return async (slotIdx, source, dest, curve, on) => {
          const s = modState.slots[slotIdx | 0];
          if (s) {
            s.source = source | 0; s.dest = dest | 0; s.curve = curve | 0; s.on = !!on;
            syncModToWorklet();
          }
          return true;
        };
      }
      if (name === 'setXlfoConfig') {
        return async (xlfoIdx, numSteps, isSynced, syncRateBeats, retriggerMode) => {
          const x = modState.xlfos[xlfoIdx | 0];
          if (x) {
            x.numSteps = clamp(numSteps | 0, 1, 32);
            x.isSynced = !!isSynced;
            x.syncRateBeats = Number(syncRateBeats) || 1.0;
            x.retriggerMode = retriggerMode | 0;
            syncModToWorklet();
          }
          return true;
        };
      }
      if (name === 'setXlfoStep') {
        return async (xlfoIdx, stepIdx, val, glide, slope) => {
          const x = modState.xlfos[xlfoIdx | 0];
          if (x && x.steps[stepIdx | 0]) {
            const st = x.steps[stepIdx | 0];
            st.value = Number(val) || 0; st.glide = Number(glide) || 0; st.slope = Number(slope) || 0;
            syncModToWorklet();
          }
          return true;
        };
      }
      if (name === 'setFollowerExtSc') {
        return async ext => { modState.followerExtSc = !!ext; return modState.followerExtSc; };
      }
      if (name === 'toggleAB') {
        return async () => {
          slots[activeSlot] = captureSnap();
          activeSlot = activeSlot === 0 ? 1 : 0;
          if (slots[activeSlot]) applySnap(slots[activeSlot], false);
          return {};
        };
      }
      if (name === 'copyAtoB') return async () => { slots[1] = captureSnap(); return {}; };
      if (name === 'copyBtoA') return async () => { slots[0] = captureSnap(); return {}; };
      if (name === 'listPresets') return async () => buildPresetState().presets.map(p => p.name);
      if (name === 'loadPreset') return async n => loadPreset(n);
      if (name === 'wdListBeaconSources') return async () => [];
      return async () => ({});
    },
  };
  window.__WD_WEB_HOST__ = host;

  function snapshotPlain() {
    const arr = new Float64Array(params.length);
    for (let i = 0; i < params.length; i++) arr[i] = getPlain(params[i].id);
    return arr;
  }

  let syncQueued = false;
  function scheduleSync() {
    if (syncQueued) return;
    syncQueued = true;
    queueMicrotask(() => {
      syncQueued = false;
      const vals = snapshotPlain();
      if (audio.node) audio.node.port.postMessage({ type: 'controls', values: vals });
      if (wasmUi.wasm) {
        for (let i = 0; i < vals.length; i++) wasmUi.wasm.wd_set_param(i, vals[i]);
        wasmUi.wasm.wd_apply();
      }
      if (typeof SPEC.onParamsChanged === 'function') SPEC.onParamsChanged(hostCtx);
    });
  }

  // ----------------------------------------------------------------- wasm + audio
  function stubImports(module) {
    const imports = {};
    for (const d of WebAssembly.Module.imports(module)) {
      imports[d.module] = imports[d.module] || {};
      imports[d.module][d.name] = d.kind === 'function' ? () => 0 : undefined;
    }
    return imports;
  }

  const wasmUrl = SPEC.wasm || `./${SPEC.slug}.wasm`;
  const modulePromise = typeof fetch === 'function'
    ? fetch(wasmUrl).then(r => r.arrayBuffer()).then(b => WebAssembly.compile(b))
    : Promise.reject(new Error('fetch unavailable'));

  // Optional UI-thread helper instance (for staticCurve evaluation in comp/multi)
  modulePromise
    .then(m => WebAssembly.instantiate(m, stubImports(m)))
    .then(inst => {
      wasmUi.wasm = inst.exports;
      wasmUi.wasm.wd_init(wasmUi.fs);
      const vals = snapshotPlain();
      for (let i = 0; i < vals.length; i++) wasmUi.wasm.wd_set_param(i, vals[i]);
      wasmUi.wasm.wd_apply();
      if (typeof SPEC.onParamsChanged === 'function') SPEC.onParamsChanged(hostCtx);
    })
    .catch(() => {});

  let demoBarCtrl = null;

  async function ensureAudio() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') await audio.ctx.resume();
      return audio.ctx;
    }
    const ctx = new AudioContext();
    audio.ctx = ctx;
    wasmUi.fs = ctx.sampleRate;
    if (wasmUi.wasm) {
      wasmUi.wasm.wd_init(ctx.sampleRate);
      const vals = snapshotPlain();
      for (let i = 0; i < vals.length; i++) wasmUi.wasm.wd_set_param(i, vals[i]);
      wasmUi.wasm.wd_apply();
    }
    await ctx.audioWorklet.addModule('./wd-plugin-worklet.js');
    const mod = await modulePromise;
    const node = new AudioWorkletNode(ctx, 'wd-plugin-worklet', {
      numberOfInputs: 1,
      numberOfOutputs: 3,
      outputChannelCount: [2, 2, 2],
      processorOptions: { module: mod },
    });
    node.port.onmessage = e => {
      const m = e.data;
      if (m && m.type === 'meters') {
        hostCtx.latestWasmMeters = m.values || [];
      } else if (m && m.type === 'ready') {
        node.port.postMessage({ type: 'controls', values: snapshotPlain() });
        node.port.postMessage({ type: 'modState', ...modState });
      }
    };
    audio.node = node;
    audio.master = ctx.createGain();
    audio.master.gain.value = 0;
    audio.postAn = ctx.createAnalyser();
    audio.preAn = ctx.createAnalyser();
    audio.auxAn = ctx.createAnalyser();
    audio.postAn.fftSize = 4096;
    audio.preAn.fftSize = 4096;
    audio.auxAn.fftSize = 4096;

    node.connect(audio.master, 0);
    audio.master.connect(ctx.destination);
    node.connect(audio.postAn, 0);
    node.connect(audio.preAn, 1);
    node.connect(audio.auxAn, 2);

    if (SPEC.needsStereoAnalysers) {
      const sp = ctx.createChannelSplitter(2);
      audio.postAnL = ctx.createAnalyser();
      audio.postAnR = ctx.createAnalyser();
      audio.postAnL.fftSize = 4096;
      audio.postAnR.fftSize = 4096;
      node.connect(sp, 0);
      sp.connect(audio.postAnL, 0);
      sp.connect(audio.postAnR, 1);
    }
    return ctx;
  }

  function stopSource() {
    if (audio.source) {
      try { audio.source.onended = null; audio.source.stop(); } catch {}
      audio.source = null;
    }
    audio.playing = false;
  }

  async function startBuffer(buffer, { offset = 0, loop = true, volumeGain = 0.49 } = {}) {
    await ensureAudio();
    stopSource();
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = !!loop;
    src.connect(audio.node);
    src.onended = () => {
      if (audio.source === src && !src.loop) {
        audio.playing = false;
        audio.source = null;
        if (demoBarCtrl) demoBarCtrl.onEndedNaturally();
      }
    };
    const t0 = audio.ctx.currentTime;
    audio.master.gain.cancelScheduledValues(t0);
    audio.master.gain.setValueAtTime(0, t0);
    audio.master.gain.linearRampToValueAtTime(volumeGain, t0 + 0.25);
    src.start(0, offset % Math.max(0.001, buffer.duration));
    audio.source = src;
    audio.playing = true;
  }

  // ----------------------------------------------------------------- FFT bins
  const FFT_N = 4096, SPEC_BINS = 240;
  const hann = new Float32Array(FFT_N);
  for (let i = 0; i < FFT_N; i++)
    hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_N - 1));
  const bitrev = new Uint16Array(FFT_N);
  for (let i = 0, j = 0; i < FFT_N; i++) {
    bitrev[i] = j;
    let bit = FFT_N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
  }
  const twRe = new Float32Array(FFT_N / 2), twIm = new Float32Array(FFT_N / 2);
  for (let i = 0; i < FFT_N / 2; i++) {
    twRe[i] = Math.cos((-2 * Math.PI * i) / FFT_N);
    twIm[i] = Math.sin((-2 * Math.PI * i) / FFT_N);
  }
  const fftRe = new Float32Array(FFT_N), fftIm = new Float32Array(FFT_N);
  const timeBuf = new Float32Array(FFT_N), mags = new Float32Array(FFT_N / 2);

  hostCtx.computeSpecBins = function computeSpecBins(analyser, out, fMin = 10, fMax = 30000) {
    if (!analyser || !audio.ctx) { out.fill(-120); return false; }
    analyser.getFloatTimeDomainData(timeBuf);
    let rms = 0;
    for (let i = 0; i < FFT_N; i++) {
      const s = timeBuf[i];
      rms += s * s;
      fftRe[bitrev[i]] = s * hann[i];
      fftIm[bitrev[i]] = 0;
    }
    if (rms < 1e-12) { out.fill(-120); return false; }
    for (let size = 2; size <= FFT_N; size <<= 1) {
      const half = size >> 1, step = FFT_N / size;
      for (let base = 0; base < FFT_N; base += size) {
        for (let k = 0, t = 0; k < half; k++, t += step) {
          const oRe = fftRe[base + k + half] * twRe[t] - fftIm[base + k + half] * twIm[t];
          const oIm = fftRe[base + k + half] * twIm[t] + fftIm[base + k + half] * twRe[t];
          fftRe[base + k + half] = fftRe[base + k] - oRe;
          fftIm[base + k + half] = fftIm[base + k] - oIm;
          fftRe[base + k] += oRe;
          fftIm[base + k] += oIm;
        }
      }
    }
    const scale = 4 / FFT_N;
    for (let k = 0; k < FFT_N / 2; k++) mags[k] = Math.hypot(fftRe[k], fftIm[k]) * scale;
    const fs = audio.ctx.sampleRate || 48000, binHz = fs / FFT_N;
    const toDb = m => (m > 1e-6 ? Math.max(-120, 20 * Math.log10(m)) : -120);
    const magAt = f => {
      const pos = Math.min(FFT_N / 2 - 1.001, Math.max(0, f / binHz));
      const k = Math.floor(pos), frac = pos - k;
      return (1 - frac) * mags[k] + frac * mags[k + 1];
    };
    for (let b = 0; b < SPEC_BINS; b++) {
      const f0 = fMin * Math.pow(fMax / fMin, b / SPEC_BINS);
      const f1 = fMin * Math.pow(fMax / fMin, (b + 1) / SPEC_BINS);
      let peak = magAt(0.5 * (f0 + f1));
      for (let k = Math.ceil(f0 / binHz); k <= f1 / binHz && k < FFT_N / 2; k++)
        peak = Math.max(peak, mags[k]);
      out[b] = toDb(peak);
    }
    return true;
  };

  let lastFrameTs = 0;
  function frameLoop(now) {
    requestAnimationFrame(frameLoop);
    if (now - lastFrameTs < 24) return;
    lastFrameTs = now;
    if (typeof SPEC.onFrame === 'function') SPEC.onFrame(hostCtx, now);
  }
  requestAnimationFrame(frameLoop);

  if (typeof window.__WD_MOUNT_DEMO_BAR__ === 'function') {
    demoBarCtrl = window.__WD_MOUNT_DEMO_BAR__({
      activeSlug: SPEC.slug,
      defaultStem: SPEC.defaultStem || 'Drums',
      getAudioContext: () => audio.ctx,
      getAudioContextAsync: ensureAudio,
      onStartBuffer: startBuffer,
      onStop: stopSource,
      onLoopChange: loop => { if (audio.source) audio.source.loop = !!loop; },
      onVolumeChange: gain => {
        if (audio.master && audio.ctx)
          audio.master.gain.setTargetAtTime(gain, audio.ctx.currentTime, 0.02);
      },
    });
  }
})();
