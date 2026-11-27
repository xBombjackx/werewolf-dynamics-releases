// Shared runner for live WebAssembly plugin pages under demo/live/.
// Renders the transport, stem selector, mode strip, canvas knobs, switches,
// meter readout, presets, AudioWorklet lifecycle, drag-and-drop custom audio,
// and shared 22-engine navigation bar.

export const LIVE_NAV = [
  ['opto.html', 'WD Opto'],
  ['mu.html', 'WD Mu'],
  ['1b.html', 'WD 1B'],
  ['tbar.html', 'WD T-Bar'],
  ['fet.html', 'WD FET'],
  ['vca.html', 'WD VCA'],
  ['duress.html', 'WD Duress'],
  ['pre.html', 'WD Pre'],
  ['tec.html', 'WD Tec'],
  ['xq.html', 'WD XQ'],
  ['tape.html', 'WD Tape'],
  ['ax.html', 'WD AX'],
  ['361.html', 'WD 361'],
  ['echo.html', 'WD Echo'],
  ['spring.html', 'WD Spring'],
  ['brigade.html', 'WD Brigade'],
  ['span.html', 'WD Span'],
  ['sumch.html', 'WD Sum Ch'],
  ['summer.html', 'WD Summer'],
  ['annihilator.html', 'WD Annihilator'],
  ['damper.html', 'WD Damper'],
  ['outboard.html', 'WD Outboard'],
];

const STEMS = [
  { label: 'Drums',    file: '../audio/duress_11.wav' },
  { label: 'Male Vox', file: '../audio/malevox_wire.wav' },
  { label: 'Bass',     file: '../audio/ax_parked.wav' },
  { label: 'E-Guitar', file: '../audio/eguitar_wire.wav' },
  { label: 'Mix Bus',  file: '../audio/sumch_honest.wav' },
];

const CSS = `
  :root {
    --room: #0B0C0E; --panel: #17181B; --chassis: #121316; --well: #101114;
    --ink: #E8E6E1; --ink-dim: #8B8D93; --ink-faint: #55575D;
    --line: #2A2C31; --line-soft: #222428;
    --accent: #F2A93C; --accent-hi: #F7BC62; --on-accent: #131313;
    --sans: "Segoe UI", system-ui, sans-serif;
    --mono: "Cascadia Mono", Consolas, monospace;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; padding: 34px 16px;
    background: var(--room); color: var(--ink);
    font-family: var(--sans);
    display: flex; flex-direction: column; align-items: center; gap: 16px;
  }
  header { text-align: center; margin-bottom: 4px; }
  header .mark { font-size: 22px; font-weight: 800; letter-spacing: 0.16em; }
  header .mark span { color: var(--accent); }
  header .sub { font-size: 10px; letter-spacing: 0.3em; color: var(--ink-faint); text-transform: uppercase; margin-top: 4px; }
  .demo {
    width: min(760px, 96vw); background: var(--panel);
    border: 1px solid rgba(0,0,0,0.75); border-radius: 6px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.5); padding: 14px 16px 16px;
  }
  .demo h2 { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; }
  .demo .blurb { margin: 6px 0 12px; font-size: 11.5px; line-height: 1.5; color: var(--ink-dim); }
  .transport { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  button {
    font-family: inherit; cursor: pointer; background: var(--well);
    color: var(--ink-dim); border: 1px solid var(--line); border-radius: 4px;
  }
  button:focus-visible { outline: 1px solid var(--accent); outline-offset: 1px; }
  .play { width: 44px; height: 34px; font-size: 13px; color: var(--ink); display: flex; align-items: center; justify-content: center; }
  .play.on { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
  .loop { height: 34px; padding: 0 10px; font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; }
  .loop.on { color: var(--accent); border-color: var(--accent); }
  .bar { flex: 1; min-width: 150px; height: 34px; position: relative; cursor: pointer; background: var(--well); border: 1px solid var(--line); border-radius: 4px; overflow: hidden; }
  .bar .fill { position: absolute; inset: 0 auto 0 0; width: 0%; background: rgba(242, 169, 60, 0.22); }
  .bar .head { position: absolute; top: 0; bottom: 0; left: 0%; width: 2px; background: var(--accent); }
  .bar .time { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); font: 500 10px var(--mono); color: var(--ink-faint); pointer-events: none; }
  .vol { display: flex; align-items: center; gap: 6px; }
  .vol label { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; color: var(--ink-faint); text-transform: uppercase; }
  .vol input { width: 72px; accent-color: var(--accent); }
  .stems, .segbar { display: flex; gap: 0; margin-top: 10px; border: 1px solid var(--line); border-radius: 4px; overflow: hidden; background: var(--well); flex-wrap: wrap; }
  .stems button, .segbar button { flex: 1; border: 0; border-radius: 0; padding: 9px 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); background: none; min-width: 84px; }
  .stems button + button, .segbar button + button { border-left: 1px solid var(--line-soft); }
  .stems button.on, .segbar button.on { background: var(--accent); color: var(--on-accent); }
  .rack {
    display: flex; align-items: flex-end; justify-content: space-between; gap: 10px;
    margin-top: 14px; padding: 12px 12px 10px;
    background: var(--chassis); border: 1px solid var(--line); border-radius: 5px; flex-wrap: wrap;
  }
  .knob { display: flex; flex-direction: column; align-items: center; gap: 4px; user-select: none; min-width: 58px; }
  .knob canvas { cursor: ns-resize; touch-action: none; }
  .knob .kname { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; color: var(--ink-dim); text-transform: uppercase; }
  .knob .kval { font: 500 10px var(--mono); color: var(--ink-faint); min-height: 11px; }
  .switches { display: flex; flex-direction: column; gap: 6px; margin-left: auto; }
  .switches button { padding: 7px 10px; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; min-width: 118px; }
  .switches button.on { color: var(--accent); border-color: var(--accent); }
  .switches button.power.on { background: var(--accent); color: var(--on-accent); }
  .meterrow { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
  .meter { flex: 1; height: 26px; position: relative; background: var(--well); border: 1px solid var(--line); border-radius: 4px; overflow: hidden; }
  .meter .grfill { position: absolute; inset: 0 auto 0 0; width: 0%; background: rgba(242, 169, 60, 0.30); }
  .meter .scale { position: absolute; inset: 0; display: flex; justify-content: space-between; padding: 0 6px; align-items: center; font: 500 9.5px var(--mono); color: var(--ink-faint); pointer-events: none; }
  .readout { font: 500 11px var(--mono); color: var(--ink-dim); min-width: 245px; text-align: right; }
  .presets { display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap; }
  .presets button { padding: 7px 12px; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .presets button.on { color: var(--accent); border-color: var(--accent); }
  .status { margin-top: 8px; font: 500 10px var(--mono); color: var(--ink-faint); min-height: 12px; letter-spacing: 0.06em; }
  .keys { font-size: 10px; color: var(--ink-faint); letter-spacing: 0.08em; text-align: center; }
  .nav { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; width: min(760px, 96vw); }
  .nav a {
    padding: 5px 10px; font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase; text-decoration: none;
    color: var(--ink-dim); background: var(--panel); border: 1px solid var(--line); border-radius: 4px;
  }
  .nav a:hover { border-color: var(--accent); color: var(--ink); }
  .nav a.on { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
  footer { font-size: 10px; color: var(--ink-faint); letter-spacing: 0.14em; text-transform: uppercase; margin-top: 8px; }
`;

class Knob {
  constructor(spec, parent, onChange) {
    this.spec = spec;
    this.value = spec.def;
    this.onChange = onChange;
    const wrap = document.createElement('div');
    wrap.className = 'knob';
    this.cv = document.createElement('canvas');
    const dpr = devicePixelRatio || 1;
    this.px = 54;
    this.cv.width = this.cv.height = this.px * dpr;
    this.cv.style.width = this.cv.style.height = this.px + 'px';
    this.cv.getContext('2d').scale(dpr, dpr);
    const name = document.createElement('div');
    name.className = 'kname';
    name.textContent = spec.name;
    this.val = document.createElement('div');
    this.val.className = 'kval';
    wrap.append(this.cv, name, this.val);
    parent.appendChild(wrap);
    this.el = wrap;

    this.cv.addEventListener('pointerdown', e => {
      this.cv.setPointerCapture(e.pointerId);
      this.dragY = e.clientY;
      this.dragV = this.value;
    });
    this.cv.addEventListener('pointermove', e => {
      if (this.dragY === undefined) return;
      const range = this.spec.max - this.spec.min;
      const scale = e.shiftKey ? 600 : 150;
      this.set(this.dragV + (this.dragY - e.clientY) / scale * range);
    });
    this.cv.addEventListener('pointerup', () => { this.dragY = undefined; });
    this.cv.addEventListener('dblclick', () => this.set(this.spec.def));
    this.set(spec.def, true);
  }
  set(v, silent) {
    let clamped = Math.min(this.spec.max, Math.max(this.spec.min, v));
    if (this.spec.step) clamped = Math.round(clamped / this.spec.step) * this.spec.step;
    this.value = clamped;
    this.draw();
    this.val.textContent = this.spec.fmt(this.value);
    if (!silent) this.onChange(this.spec.id, this.value);
  }
  draw() {
    const g = this.cv.getContext('2d'), s = this.px, cx = s / 2, cy = s / 2, r = s / 2 - 6;
    const t = (this.value - this.spec.min) / (this.spec.max - this.spec.min || 1);
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, a = a0 + t * (a1 - a0);
    g.clearRect(0, 0, s, s);
    g.lineWidth = 3; g.lineCap = 'round';
    g.strokeStyle = '#2A2C31';
    g.beginPath(); g.arc(cx, cy, r, a0, a1); g.stroke();
    g.strokeStyle = '#F2A93C';
    g.beginPath(); g.arc(cx, cy, r, a0, a); g.stroke();
    g.fillStyle = '#17181B';
    g.beginPath(); g.arc(cx, cy, r - 6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#E8E6E1'; g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 4, cy + Math.sin(a) * 4);
    g.lineTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8));
    g.stroke();
  }
}

export function mountLiveDemo(cfg) {
  document.title = `Werewolf Dynamics \u2014 ${cfg.title}, Live`;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const navLinks = LIVE_NAV.map(([href, label]) =>
    `<a href="${href}"${href === cfg.page ? ' class="on"' : ''}>${label}</a>`).join('\n  ');

  const meterTicks = (cfg.meter?.ticks || ['0', '25%', '50%', '75%', '100%'])
    .map(t => `<span>${t}</span>`).join('');

  document.body.innerHTML = `
    <header>
      <div class="mark">WEREWOLF <span>DYNAMICS</span></div>
      <div class="sub">${cfg.title.toLowerCase()} &middot; running live in your browser</div>
    </header>
    <div class="keys">Space = play/pause &middot; drag &amp; drop your own clip anywhere &middot; real circuit engine compiled to WebAssembly, not a recording</div>
    <nav class="nav" aria-label="Live engines">
      ${navLinks}
      <a href="../demos/">17 A/B Demos</a>
      <a href="../">Home</a>
    </nav>
    <section class="demo">
      <h2>${cfg.title} &mdash; live</h2>
      <p class="blurb">${cfg.blurb}</p>
      <div class="transport">
        <button class="play" id="play" title="Play / pause">&#9654;</button>
        <button class="loop on" id="loop" title="Loop">LOOP</button>
        <button class="loop" id="pick" title="Load a local audio file">YOUR CLIP&hellip;</button>
        <input id="fileIn" type="file" accept="audio/*" hidden>
        <div class="bar" id="bar"><div class="fill"></div><div class="head"></div><div class="time">0:00</div></div>
        <div class="vol"><label for="vol">Vol</label><input id="vol" type="range" min="0" max="100" value="60"></div>
      </div>
      <div class="stems" id="stems"></div>
      ${cfg.modes ? '<div class="segbar" id="modes"></div>' : ''}
      <div class="rack" id="rack"><div class="switches" id="switches"></div></div>
      <div class="meterrow">
        <div class="meter"><div class="grfill" id="grfill"></div><div class="scale">${meterTicks}</div></div>
        <div class="readout" id="readout">${cfg.meter?.init || 'Ready'}</div>
      </div>
      <div class="presets" id="presets"></div>
      <div class="status" id="status">loading engine&hellip;</div>
    </section>
    <footer>same DSP core as the plugin &middot; verified against the desktop build every release</footer>
  `;

  const state = { ...cfg.defaults };
  const statusEl = document.getElementById('status');
  const SMOKE = new URLSearchParams(location.search).has('smoke');
  let playing = false, ctx = null, worklet = null, outGain = null, srcNode = null;
  let wasmBytes = null, wasmMod = null, curBuf = null;
  const stemBufs = new Map();
  let activeStem = cfg.defaultStem ?? 0;
  let startTime = 0, offset = 0, loop = true, customName = null;

  const smokeStamp = () => {
    if (SMOKE) {
      document.title = `SMOKE ${playing ? 'PLAYING' : 'STOPPED'} | ctx ${ctx ? ctx.state : 'none'} | ${document.getElementById('readout').textContent} | ${statusEl.textContent}`;
    }
  };
  const status = t => { statusEl.textContent = t; smokeStamp(); };
  const setParam = (id, v) => {
    state[id] = v;
    if (worklet) worklet.port.postMessage({ t: 'p', id, v });
  };
  const pushAllParams = () => {
    if (!worklet) return;
    for (const [id, v] of Object.entries(state)) worklet.port.postMessage({ t: 'p', id: Number(id), v });
  };

  const rackEl = document.getElementById('rack');
  const swEl = document.getElementById('switches');
  const knobs = {};
  for (const spec of cfg.knobs) {
    const k = new Knob(spec, rackEl, (id, v) => { setParam(id, v); });
    rackEl.insertBefore(k.el, swEl);
    knobs[spec.id] = k;
  }

  let syncModes = () => {};
  if (cfg.modes) {
    const modesEl = document.getElementById('modes');
    const modeVals = cfg.modes.values || cfg.modes.labels.map((_, i) => i);
    const modeBtns = cfg.modes.labels.map((label, idx) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = () => { setParam(cfg.modes.param, modeVals[idx]); syncModes(); };
      modesEl.appendChild(b);
      return b;
    });
    syncModes = () => {
      const cur = state[cfg.modes.param];
      modeBtns.forEach((b, i) => b.classList.toggle('on', Math.abs(cur - modeVals[i]) < 0.01));
    };
  }

  const swUpdaters = [];
  for (const sw of cfg.switches) {
    const b = document.createElement('button');
    if (sw.power) b.className = 'power';
    const vals = sw.values || [0, 1];
    const render = () => {
      const cur = state[sw.param];
      let idx = vals.findIndex(v => Math.abs(v - cur) < 0.01);
      if (idx < 0) idx = 0;
      b.textContent = sw.labels ? sw.labels[idx] : sw.label;
      b.classList.toggle('on', sw.onWhen ? sw.onWhen(cur) : idx > 0);
    };
    b.onclick = () => {
      const cur = state[sw.param];
      let idx = vals.findIndex(v => Math.abs(v - cur) < 0.01);
      const nextIdx = (idx + 1) % vals.length;
      setParam(sw.param, vals[nextIdx]);
      render();
    };
    swEl.appendChild(b);
    swUpdaters.push(render);
  }
  const syncButtons = () => { syncModes(); swUpdaters.forEach(fn => fn()); };
  syncButtons();

  const presetsEl = document.getElementById('presets');
  const presetBtns = (cfg.presets || []).map((pr, idx) => {
    const b = document.createElement('button');
    b.textContent = pr.label;
    if (idx === 0) b.classList.add('on');
    b.onclick = () => {
      presetBtns.forEach(pb => pb.classList.toggle('on', pb === b));
      const next = { ...cfg.defaults, ...pr.vals };
      for (const [id, v] of Object.entries(next)) {
        const nid = Number(id);
        setParam(nid, v);
        if (knobs[nid]) knobs[nid].set(v, true);
      }
      syncButtons();
    };
    presetsEl.appendChild(b);
    return b;
  });

  const stemsEl = document.getElementById('stems');
  STEMS.forEach((s, i) => {
    const b = document.createElement('button');
    b.textContent = s.label;
    if (i === activeStem) b.classList.add('on');
    b.onclick = () => selectStem(i);
    stemsEl.appendChild(b);
  });

  async function loadWasmBytes() {
    if (wasmBytes) return;
    const res = await fetch(cfg.wasm);
    if (!res.ok) throw new Error(`failed to fetch ${cfg.wasm} (${res.status})`);
    wasmBytes = await res.arrayBuffer();
    wasmMod = await WebAssembly.compile(wasmBytes);
  }

  async function ensureAudio() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
      outGain = ctx.createGain();
      outGain.gain.value = document.getElementById('vol').value / 100;
      outGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') await ctx.resume();
    if (!worklet) {
      status('loading wasm engine...');
      await loadWasmBytes();
      await ctx.audioWorklet.addModule('wd-worklet.js');
      try {
        worklet = new AudioWorkletNode(ctx, 'wd-live', {
          numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
          processorOptions: { module: wasmMod },
        });
      } catch {
        worklet = new AudioWorkletNode(ctx, 'wd-live', {
          numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
          processorOptions: { bytes: wasmBytes.slice(0) },
        });
      }
      worklet.connect(outGain);
      worklet.port.onmessage = ({ data: m }) => {
        if (m.t === 'ready') {
          pushAllParams();
          status(customName ? `playing custom clip: ${customName}` : `ready · ${STEMS[activeStem].label} · live at ${ctx.sampleRate} Hz`);
        } else if (m.t === 'error') {
          status(`worklet error: ${m.message}`);
        } else if (m.t === 'meters') {
          const pct = Math.max(0, Math.min(100, cfg.meter.pct(m)));
          document.getElementById('grfill').style.width = `${pct.toFixed(1)}%`;
          document.getElementById('readout').textContent = cfg.meter.text(m);
          smokeStamp();
        }
      };
    }
  }

  async function loadStemBuffer(idx) {
    const key = STEMS[idx].file;
    if (stemBufs.has(key)) return stemBufs.get(key);
    status(`loading ${STEMS[idx].label}...`);
    const res = await fetch(key);
    if (!res.ok) throw new Error(`stem HTTP ${res.status}`);
    const buf = await ctx.decodeAudioData(await res.arrayBuffer());
    stemBufs.set(key, buf);
    return buf;
  }

  function stopSource() {
    if (srcNode) {
      try { srcNode.onended = null; srcNode.stop(); srcNode.disconnect(); } catch {}
      srcNode = null;
    }
  }
  function curPos() {
    if (!curBuf) return 0;
    const t = offset + (playing ? (ctx.currentTime - startTime) : 0);
    return loop && curBuf.duration > 0 ? (t % curBuf.duration) : Math.min(t, curBuf.duration);
  }
  function syncPlayBtn() {
    const pb = document.getElementById('play');
    pb.classList.toggle('on', playing);
    pb.innerHTML = playing ? '&#9646;&#9646;' : '&#9654;';
  }
  function startPlayback(fromSec) {
    if (!curBuf || !worklet) return;
    stopSource();
    srcNode = ctx.createBufferSource();
    srcNode.buffer = curBuf;
    srcNode.loop = loop;
    srcNode.connect(worklet);
    offset = Math.max(0, Math.min(fromSec, Math.max(0, curBuf.duration - 0.01)));
    startTime = ctx.currentTime;
    playing = true;
    srcNode.onended = () => { if (!loop) { playing = false; offset = 0; syncPlayBtn(); smokeStamp(); } };
    srcNode.start(0, offset);
    syncPlayBtn();
    status(customName ? `custom clip: ${customName} · live @ ${ctx.sampleRate} Hz` : `${STEMS[activeStem].label} · live @ ${ctx.sampleRate} Hz`);
  }
  async function togglePlay() {
    try {
      await ensureAudio();
      if (!curBuf) curBuf = await loadStemBuffer(activeStem);
      if (playing) { offset = curPos(); stopSource(); playing = false; syncPlayBtn(); smokeStamp(); }
      else startPlayback(offset);
    } catch (e) { status(`error: ${e.message}`); }
  }
  async function selectStem(idx) {
    activeStem = idx; customName = null;
    [...stemsEl.children].forEach((b, i) => b.classList.toggle('on', i === idx));
    try { await ensureAudio(); curBuf = await loadStemBuffer(idx); startPlayback(0); }
    catch (e) { status(`error: ${e.message}`); }
  }
  async function loadCustomFile(file) {
    try {
      await ensureAudio();
      curBuf = await ctx.decodeAudioData(await file.arrayBuffer());
      customName = file.name;
      [...stemsEl.children].forEach(b => b.classList.remove('on'));
      startPlayback(0);
    } catch (e) { status(`could not decode file: ${e.message}`); }
  }

  document.getElementById('play').onclick = togglePlay;
  document.getElementById('loop').onclick = function () { loop = !loop; this.classList.toggle('on', loop); if (srcNode) srcNode.loop = loop; };
  document.getElementById('vol').oninput = function () { if (outGain) outGain.gain.value = this.value / 100; };
  document.getElementById('pick').onclick = () => document.getElementById('fileIn').click();
  document.getElementById('fileIn').onchange = e => { if (e.target.files[0]) loadCustomFile(e.target.files[0]); };
  document.getElementById('bar').onclick = e => {
    if (!curBuf) return;
    const r = e.currentTarget.getBoundingClientRect();
    const target = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * curBuf.duration;
    if (playing) startPlayback(target); else offset = target;
  };
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) loadCustomFile(f); });
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement.tagName)) {
      e.preventDefault(); togglePlay();
    }
  });
  const fmtTime = s => { s = Math.max(0, s); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
  function tick() {
    if (curBuf) {
      const p = curPos(), pct = curBuf.duration > 0 ? (p / curBuf.duration) * 100 : 0;
      document.querySelector('#bar .fill').style.width = `${pct}%`;
      document.querySelector('#bar .head').style.left = `${pct}%`;
      document.querySelector('#bar .time').textContent = fmtTime(p);
    }
    requestAnimationFrame(tick);
  }
  tick();
  loadWasmBytes().then(() => status('ready \u2014 press play')).catch(e => status(`load error: ${e.message}`));
  if (SMOKE) { smokeStamp(); setTimeout(() => togglePlay(), 50); }
}
