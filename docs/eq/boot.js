// boot.js — web host for the Werewolf Digital EQ demo page.
//
// Loaded as a classic script (before the UI's inline module evaluates), it
// impersonates the JUCE WebView2 backend: window.__JUCE__ plus the state
// objects dist/juce/index.js hands to the UI. The DSP is the same PrismEq
// core as the plugin, compiled to wasm — one instance in an AudioWorklet
// for sound, one on this thread for response curves.
(() => {
  'use strict';

  // ------------------------------------------------------------ param store
  // Normalised values keyed by APVTS param id, same skew math as the UI.
  const RANGES = {
    freq:  { min: 10, max: 30000, centre: 1000 },
    gain:  { min: -30, max: 30 },
    q:     { min: 0.025, max: 40, centre: 1 },
    slope: { min: 6, max: 96, centre: 24 },
    input: { min: -18, max: 18 },
    output:{ min: -24, max: 12 },
    mix:   { min: 0, max: 100 },
    listen:{ min: 0, max: 24 },
    dynrange:  { min: -24, max: 24 },
    dynthresh: { min: -60, max: 0 },
    dynatk:    { min: 0.05, max: 250, centre: 20 },
    dynrel:    { min: 1, max: 2500, centre: 150 },
    dynlink:   { min: 0, max: 100 },
  };
  const skewOf = r => r.centre
    ? Math.log(0.5) / Math.log((r.centre - r.min) / (r.max - r.min)) : 1;
  const fromNorm = (r, p) => {
    p = Math.min(1, Math.max(0, p));
    const s = skewOf(r);
    if (s !== 1 && p > 0) p = Math.exp(Math.log(p) / s);
    return r.min + (r.max - r.min) * p;
  };
  const toNorm = (r, v) => {
    let p = Math.min(1, Math.max(0, (v - r.min) / (r.max - r.min)));
    const s = skewOf(r);
    if (s !== 1 && p > 0) p = Math.pow(p, s);
    return p;
  };

  const CHOICES = { shape: 9, chan: 5, listenchan: 5, channelmode: 3,
                    phase: 3, quality: 4, chassis: 2, unit: 2,
                    dynsc: 2, lookahead: 4 };
  const suffixOf = id => (id.match(/^b\d+(.*)$/) || [null, id])[1];

  const sliderDefault = id => {
    switch (suffixOf(id)) {
      case 'freq': return toNorm(RANGES.freq, 1000);
      case 'gain': return 0.5;
      case 'q': return toNorm(RANGES.q, 1);
      case 'slope': return toNorm(RANGES.slope, 24);
      case 'input': return toNorm(RANGES.input, 0);
      case 'output': return toNorm(RANGES.output, 0);
      case 'mix': return 1;
      case 'dynrange': return 0.5;
      case 'dynthresh': return toNorm(RANGES.dynthresh, -30);
      case 'dynatk': return 0.5;
      case 'dynrel': return 0.5;
      case 'dynlink': return 1;
      case 'dynscfreq': return toNorm(RANGES.freq, 1000);
      default: return 0;
    }
  };
  const toggleDefault = id => {
    const s = suffixOf(id);
    return id === 'power' || s === 'dynauto' || s === 'dynscfreqtrack';
  };

  const values = new Map(); // id -> normalised (sliders/combos) or bool
  const listeners = new Map(); // id -> [cb]
  const fire = id => { for (const cb of listeners.get(id) || []) cb(); };
  const listen = (id, cb) => {
    if (!listeners.has(id)) listeners.set(id, []);
    listeners.get(id).push(cb);
  };

  const sliderStates = {}, comboStates = {}, toggleStates = {};

  const host = {
    sliderState(id) {
      if (!sliderStates[id]) {
        if (!values.has(id)) values.set(id, sliderDefault(id));
        sliderStates[id] = {
          getNormalisedValue: () => values.get(id),
          setNormalisedValue: v => {
            v = Math.min(1, Math.max(0, v));
            if (values.get(id) === v) return;
            values.set(id, v); fire(id); scheduleSync();
          },
          sliderDragStarted: () => {},
          sliderDragEnded: () => {},
          valueChangedEvent: { addListener: cb => listen(id, cb) },
        };
      }
      return sliderStates[id];
    },
    comboState(id) {
      if (!comboStates[id]) {
        if (!values.has(id)) values.set(id, 0);
        const n = CHOICES[suffixOf(id)] || 2;
        comboStates[id] = {
          get value() { return values.get(id); },
          setChoiceIndex: i => {
            const v = n > 1 ? Math.min(1, Math.max(0, i / (n - 1))) : 0;
            if (values.get(id) === v) return;
            values.set(id, v); fire(id); scheduleSync();
          },
          valueChangedEvent: { addListener: cb => listen(id, cb) },
        };
      }
      return comboStates[id];
    },
    toggleState(id) {
      if (!toggleStates[id]) {
        if (!values.has(id)) values.set(id, toggleDefault(id));
        toggleStates[id] = {
          getValue: () => !!values.get(id),
          setValue: v => {
            if (!!values.get(id) === !!v) return;
            values.set(id, !!v); fire(id); scheduleSync();
          },
          valueChangedEvent: { addListener: cb => listen(id, cb) },
        };
      }
      return toggleStates[id];
    },
    nativeFunction(name) {
      if (name === 'requestResponse') return async () => { responseDirty = true; };
      if (name === 'getUiState') return async () => ({
        build: 'web demo · wasm core',
        sampleRate: audio.ctx ? audio.ctx.sampleRate : 48000,
      });
      return async () => {};
    },
  };
  window.__WD_WEB_HOST__ = host;

  const eventListeners = new Map();
  const emit = (name, payload) => {
    for (const cb of eventListeners.get(name) || []) cb(payload);
  };
  window.__JUCE__ = {
    backend: {
      addEventListener: (name, cb) => {
        if (!eventListeners.has(name)) eventListeners.set(name, []);
        eventListeners.get(name).push(cb);
      },
    },
  };

  // ----------------------------------------------------- controls snapshot
  const real = (id, range) => fromNorm(range, values.get(id) ?? sliderDefault(id));
  const comboIdx = (id, n) => Math.round((values.get(id) ?? 0) * (n - 1));
  const boolVal = id => (values.get(id) ?? toggleDefault(id)) ? 1 : 0;
  const bandId = (i, s) => 'b' + (i + 1) + s;

  const BAND_STRIDE = 15;
  function snapshot() {
    const globals = new Float64Array([
      real('input', RANGES.input),
      real('output', RANGES.output),
      real('mix', RANGES.mix),
      boolVal('delta'),
      boolVal('power'),
      Math.round(real('listen', RANGES.listen)),
      comboIdx('listenchan', 5),
      boolVal('autogain'),
      comboIdx('lookahead', 4),
    ]);
    const bands = new Float64Array(24 * BAND_STRIDE);
    for (let i = 0; i < 24; i++) {
      const o = i * BAND_STRIDE;
      bands[o]     = boolVal(bandId(i, 'on'));
      bands[o + 1] = comboIdx(bandId(i, 'shape'), 9);
      bands[o + 2] = comboIdx(bandId(i, 'chan'), 5);
      bands[o + 3] = real(bandId(i, 'freq'), RANGES.freq);
      bands[o + 4] = real(bandId(i, 'gain'), RANGES.gain);
      bands[o + 5] = real(bandId(i, 'q'), RANGES.q);
      bands[o + 6] = real(bandId(i, 'slope'), RANGES.slope);
      bands[o + 7] = boolVal(bandId(i, 'dynon'));
      bands[o + 8] = real(bandId(i, 'dynrange'), RANGES.dynrange);
      bands[o + 9] = boolVal(bandId(i, 'dynauto'));
      bands[o + 10] = real(bandId(i, 'dynthresh'), RANGES.dynthresh);
      bands[o + 11] = real(bandId(i, 'dynatk'), RANGES.dynatk);
      bands[o + 12] = real(bandId(i, 'dynrel'), RANGES.dynrel);
      bands[o + 13] = boolVal(bandId(i, 'dynscfreqtrack'));
      bands[o + 14] = real(bandId(i, 'dynscfreq'), RANGES.freq);
    }
    return { globals, bands };
  }

  let syncQueued = false;
  let responseDirty = true;
  function scheduleSync() {
    if (syncQueued) return;
    syncQueued = true;
    queueMicrotask(() => {
      syncQueued = false;
      const snap = snapshot();
      if (audio.node)
        audio.node.port.postMessage({ type: 'controls', ...snap });
      if (resp.wasm) applyToResponse(snap);
      responseDirty = true;
    });
  }

  // ------------------------------------------------------------- wasm load
  const stubImports = module => {
    const imports = {};
    for (const d of WebAssembly.Module.imports(module)) {
      imports[d.module] = imports[d.module] || {};
      imports[d.module][d.name] = d.kind === 'function' ? () => 0 : undefined;
    }
    return imports;
  };
  const modulePromise = fetch('./prism.wasm')
    .then(r => r.arrayBuffer())
    .then(bytes => WebAssembly.compile(bytes));

  // Response-curve instance (UI thread, never touches audio).
  const resp = { wasm: null, fs: 48000 };
  modulePromise
    .then(m => WebAssembly.instantiate(m, stubImports(m)))
    .then(instance => {
      resp.wasm = instance.exports;
      resp.wasm.prism_init(resp.fs);
      applyToResponse(snapshot());
      responseDirty = true;
    });

  function applyToResponse(snap) {
    const g = snap.globals;
    resp.wasm.prism_set_globals(g[0], g[1], g[2], g[3], g[4], g[5], g[6],
                                g[7], g[8]);
    const b = snap.bands;
    for (let i = 0; i < 24; i++) {
      const o = i * BAND_STRIDE;
      resp.wasm.prism_set_band(i, b[o], b[o + 1], b[o + 2],
                               b[o + 3], b[o + 4], b[o + 5], b[o + 6],
                               b[o + 7], b[o + 8], b[o + 9], b[o + 10],
                               b[o + 11], b[o + 12], b[o + 13], b[o + 14]);
    }
    resp.wasm.prism_apply();
  }

  // Same grid strategy as PrismEditor::buildResponse — a log base plus a
  // bandwidth-proportional cluster around every enabled band.
  function emitResponse() {
    if (!resp.wasm) return;
    const fs = resp.fs;
    const fMin = 10, fMax = 30000;
    const freqs = [];
    const base = 96;
    for (let i = 0; i <= base; i++)
      freqs.push(fMin * Math.pow(fMax / fMin, i / base));
    const snap = snapshot();
    const enabled = [];
    for (let i = 0; i < 24; i++) {
      const o = i * BAND_STRIDE;
      if (!snap.bands[o]) continue;
      enabled.push(i);
      const centre = snap.bands[o + 3];
      const q = Math.max(0.025, snap.bands[o + 5]);
      const halfBw = Math.max(0.006, 0.72134752 * Math.asinh(1 / (2 * q)));
      const add = oct => {
        const f = centre * Math.pow(2, oct);
        if (f >= fMin && f <= fMax) freqs.push(f);
      };
      add(0);
      for (const t of [0.2, 0.45, 0.75, 1.1, 1.6, 2.4, 3.6]) {
        add(t * halfBw); add(-t * halfBw);
      }
      for (const o2 of [0.03, 0.08, 0.16, 0.3, 0.55, 1.0]) {
        add(o2); add(-o2);
      }
    }
    freqs.sort((a, b) => a - b);

    const total = freqs.map(f => resp.wasm.prism_response_db(f));
    const bands = [];
    for (let i = 0; i < 24; i++) {
      const o = i * BAND_STRIDE;
      const band = {
        i,
        on: !!snap.bands[o],
        shape: snap.bands[o + 1],
        freq: snap.bands[o + 3],
        gain: snap.bands[o + 4],
        q: snap.bands[o + 5],
        slope: snap.bands[o + 6],
        chan: snap.bands[o + 2],
        dyn: !!(values.get(bandId(i, 'dynon'))),
      };
      if (band.on)
        band.curve = freqs.map(f => resp.wasm.prism_band_response_db(i, f));
      bands.push(band);
    }
    emit('response', { sampleRate: fs, freqs, total, bands });
  }

  // ------------------------------------------------------------ audio graph
  const audio = { ctx: null, node: null, master: null, source: null,
                  preAn: null, postAn: null,
                  buffer: null, playing: false, noise: false };

  // Master volume: square-law slider (default 60 ≈ -9 dB) plus a 300 ms
  // fade-in on every start, so playback never slams out at full level.
  let volValue = 60;
  const volGain = () => Math.pow(volValue / 100, 2);

  async function ensureAudio() {
    if (audio.ctx) { await audio.ctx.resume(); return; }
    const ctx = new AudioContext();
    audio.ctx = ctx;
    resp.fs = ctx.sampleRate;
    if (resp.wasm) {
      resp.wasm.prism_init(resp.fs);
      applyToResponse(snapshot());
      responseDirty = true;
    }
    await ctx.audioWorklet.addModule('./worklet.js');
    const module = await modulePromise;
    const node = new AudioWorkletNode(ctx, 'wd-prism', {
      numberOfInputs: 1,
      numberOfOutputs: 2,
      outputChannelCount: [2, 2],
      processorOptions: { module },
    });
    node.port.onmessage = e => {
      const m = e.data;
      if (m.type === 'meters') emit('meters', m); // in/out/ag/rides/dets/thrs
      if (m.type === 'ready') node.port.postMessage({ type: 'controls', ...snapshot() });
    };
    audio.node = node;
    audio.master = ctx.createGain();
    audio.master.gain.value = 0;
    audio.preAn = ctx.createAnalyser();
    audio.postAn = ctx.createAnalyser();
    audio.preAn.fftSize = 4096;
    audio.postAn.fftSize = 4096;
    node.connect(audio.master, 0);
    audio.master.connect(ctx.destination);
    node.connect(audio.postAn, 0);
    node.connect(audio.preAn, 1);
  }

  function stopSource() {
    if (audio.source) { try { audio.source.stop(); } catch (e) {} audio.source = null; }
    audio.playing = false;
    updateBar();
  }

  function startSource(buffer) {
    stopSource();
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(audio.node);
    const t0 = audio.ctx.currentTime;
    audio.master.gain.cancelScheduledValues(t0);
    audio.master.gain.setValueAtTime(0, t0);
    audio.master.gain.linearRampToValueAtTime(volGain(), t0 + 0.3);
    src.start();
    audio.source = src;
    audio.playing = true;
    updateBar();
  }

  function pinkNoiseBuffer(ctx) {
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1; // Paul Kellet pink filter
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    return buf;
  }

  async function loadFile(file) {
    await ensureAudio();
    const bytes = await file.arrayBuffer();
    let decoded;
    try {
      decoded = await audio.ctx.decodeAudioData(bytes);
    } catch (e) {
      barStatus.textContent = 'could not decode "' + file.name + '"';
      return;
    }
    audio.buffer = decoded;
    audio.noise = false;
    barStatus.textContent = file.name + ' · '
      + decoded.duration.toFixed(1) + 's · looping';
    startSource(decoded);
  }

  // ---------------------------------------------------------- transport bar
  let barStatus, playBtn, noiseBtn;
  function buildBar() {
    const bar = document.createElement('div');
    bar.id = 'webTransport';
    bar.style.cssText =
      'display:flex;align-items:center;gap:10px;padding:6px 14px;' +
      'background:var(--panel,#141821);border-bottom:1px solid var(--line,#232a36);' +
      'flex:0 0 auto;font:11px "Segoe UI",system-ui,sans-serif;' +
      'color:var(--text,#d5dce8);z-index:10;';

    const mkBtn = label => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText =
        'background:none;border:1px solid var(--line,#232a36);border-radius:4px;' +
        'color:inherit;font:inherit;padding:3px 10px;cursor:pointer;letter-spacing:0.08em;';
      return b;
    };

    const tag = document.createElement('span');
    tag.textContent = 'TRY IT';
    tag.style.cssText = 'color:var(--accent,#6fd3ff);font-weight:600;letter-spacing:0.15em;';
    bar.appendChild(tag);

    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'audio/*';
    file.style.display = 'none';
    file.addEventListener('change', () => {
      if (file.files[0]) loadFile(file.files[0]);
    });
    bar.appendChild(file);

    const loadBtn = mkBtn('LOAD AUDIO');
    loadBtn.addEventListener('click', () => file.click());
    bar.appendChild(loadBtn);

    noiseBtn = mkBtn('PINK NOISE');
    noiseBtn.addEventListener('click', async () => {
      await ensureAudio();
      if (audio.noise && audio.playing) { stopSource(); return; }
      audio.buffer = pinkNoiseBuffer(audio.ctx);
      audio.noise = true;
      barStatus.textContent = 'pink noise · looping';
      startSource(audio.buffer);
    });
    bar.appendChild(noiseBtn);

    playBtn = mkBtn('PLAY');
    playBtn.addEventListener('click', async () => {
      await ensureAudio();
      if (audio.playing) stopSource();
      else if (audio.buffer) startSource(audio.buffer);
    });
    bar.appendChild(playBtn);

    const volWrap = document.createElement('span');
    volWrap.style.cssText = 'display:inline-flex;align-items:center;gap:5px;color:var(--dim,#6d7789);letter-spacing:0.08em;';
    const volLabel = document.createElement('span');
    volLabel.textContent = 'VOL';
    const vol = document.createElement('input');
    vol.type = 'range';
    vol.min = '0';
    vol.max = '100';
    vol.value = String(volValue);
    vol.style.cssText = 'width:80px;accent-color:var(--accent,#6fd3ff);';
    vol.addEventListener('input', () => {
      volValue = vol.valueAsNumber;
      if (audio.master)
        audio.master.gain.setTargetAtTime(volGain(), audio.ctx.currentTime, 0.02);
    });
    volWrap.append(volLabel, vol);
    bar.appendChild(volWrap);

    barStatus = document.createElement('span');
    barStatus.style.cssText = 'color:var(--dim,#6d7789);';
    barStatus.textContent = 'load a track or start pink noise — audio loops while you shape the EQ · drag & drop works too';
    bar.appendChild(barStatus);

    document.body.insertBefore(bar, document.body.firstChild);

    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => {
      e.preventDefault();
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) loadFile(f);
    });
  }
  function updateBar() {
    if (playBtn) {
      playBtn.textContent = audio.playing ? 'STOP' : 'PLAY';
      playBtn.style.borderColor = audio.playing ? 'var(--accent,#6fd3ff)' : '';
    }
  }

  // --------------------------------------------------------------- spectrum
  // Native parity: Hann window, 4096 FFT, full-scale sine = 0 dB, 240
  // log-spaced display bins holding the peak over their span.
  const FFT_N = 4096, SPEC_BINS = 240, SPEC_FMIN = 10, SPEC_FMAX = 30000;
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
    twRe[i] = Math.cos(-2 * Math.PI * i / FFT_N);
    twIm[i] = Math.sin(-2 * Math.PI * i / FFT_N);
  }
  const fftRe = new Float32Array(FFT_N), fftIm = new Float32Array(FFT_N);
  const timeBuf = new Float32Array(FFT_N);
  const mags = new Float32Array(FFT_N / 2);

  function computeBins(analyser, out) {
    analyser.getFloatTimeDomainData(timeBuf);
    for (let i = 0; i < FFT_N; i++) {
      fftRe[bitrev[i]] = timeBuf[i] * hann[i];
      fftIm[bitrev[i]] = 0;
    }
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
    const scale = 4 / FFT_N; // 2/N over Hann coherent gain 0.5
    for (let k = 0; k < FFT_N / 2; k++)
      mags[k] = Math.hypot(fftRe[k], fftIm[k]) * scale;

    const fs = audio.ctx.sampleRate, binHz = fs / FFT_N;
    const toDb = m => m > 1e-6 ? Math.max(-120, 20 * Math.log10(m)) : -120;
    const magAt = f => {
      const pos = Math.min(FFT_N / 2 - 1.001, Math.max(0, f / binHz));
      const k = Math.floor(pos), frac = pos - k;
      return (1 - frac) * mags[k] + frac * mags[k + 1];
    };
    for (let b = 0; b < SPEC_BINS; b++) {
      const f0 = SPEC_FMIN * Math.pow(SPEC_FMAX / SPEC_FMIN, b / SPEC_BINS);
      const f1 = SPEC_FMIN * Math.pow(SPEC_FMAX / SPEC_FMIN, (b + 1) / SPEC_BINS);
      let peak = magAt(0.5 * (f0 + f1));
      for (let k = Math.ceil(f0 / binHz); k <= f1 / binHz && k < FFT_N / 2; k++)
        peak = Math.max(peak, mags[k]);
      out[b] = toDb(peak);
    }
  }

  const preBins = new Array(SPEC_BINS).fill(-120);
  const postBins = new Array(SPEC_BINS).fill(-120);
  let lastSpec = 0;

  // ----------------------------------------------------------------- pump
  function tick(now) {
    requestAnimationFrame(tick);
    if (responseDirty && resp.wasm) {
      responseDirty = false;
      emitResponse();
    }
    if (audio.playing && audio.preAn && now - lastSpec > 33) {
      lastSpec = now;
      computeBins(audio.preAn, preBins);
      computeBins(audio.postAn, postBins);
      emit('spectrum', { pre: preBins, post: postBins });
    }
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', buildBar);
  else
    buildBar();
  requestAnimationFrame(tick);
})();
