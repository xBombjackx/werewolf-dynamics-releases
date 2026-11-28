// demo-bar.js — shared top transport bar, musical stems, custom WAV loader,
// and 14-plugin switcher for Werewolf Digital live WebAssembly browser demos.
(() => {
  'use strict';

  const PLUGINS = [
    ['eq', 'EQ'],
    ['comp', 'Compressor'],
    ['limiter', 'Limiter'],
    ['multi', 'Multiband'],
    ['gate', 'Gate'],
    ['deess', 'De-Esser'],
    ['verb', 'Reverb'],
    ['sat', 'Saturator'],
    ['mod', 'Modulation'],
    ['delay', 'Delay'],
    ['retro', 'Retro'],
    ['filter', 'Filter'],
    ['vox', 'Vox'],
    ['meter', 'Meter'],
  ];

  const STEMS = [
    { key: 'Drums',      label: 'Drums',      file: 'duress_11.wav' },
    { key: 'Male Vox',   label: 'Male Vox',   file: 'malevox_wire.wav' },
    { key: 'Female Vox', label: 'Female Vox', file: 'ax_parked.wav' },
    { key: 'E-Guitar',   label: 'E-Guitar',   file: 'eguitar_wire.wav' },
    { key: 'Keys',       label: 'Keys',       file: 'sumch_honest.wav' },
  ];

  function fmtTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function pinkNoiseBuffer(ctx) {
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
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

  function synthFallbackBuffer(ctx, stemKey) {
    const sr = ctx.sampleRate || 48000;
    const dur = 4.0;
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(2, len, sr);
    const l = buf.getChannelData(0);
    const r = buf.getChannelData(1);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const beat = (t * 2.0) % 1.0; // 120 BPM quarter notes
      let sL = 0, sR = 0;
      if (stemKey === 'Drums') {
        const kick = Math.exp(-beat * 18.0) * Math.sin(2 * Math.PI * (52 + 95 * Math.exp(-beat * 34)) * t);
        const snarePos = (t * 2.0 + 0.5) % 1.0;
        const snare = Math.exp(-snarePos * 24.0) * (0.4 * Math.sin(2 * Math.PI * 195 * t) + 0.3 * (Math.random() * 2 - 1));
        sL = sR = 0.55 * (kick + snare);
      } else {
        const f = stemKey.includes('Vox') ? 220 : stemKey === 'E-Guitar' ? 146.83 : 261.63;
        const env = 0.35 * (0.55 + 0.45 * Math.sin(2 * Math.PI * 0.5 * t));
        sL = env * (0.6 * Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * 2 * f * t));
        sR = env * (0.6 * Math.sin(2 * Math.PI * f * 1.002 * t) + 0.25 * Math.sin(2 * Math.PI * 2 * f * t + 0.4));
      }
      l[i] = Math.max(-0.9, Math.min(0.9, sL));
      r[i] = Math.max(-0.9, Math.min(0.9, sR));
    }
    return buf;
  }

  function injectStyle() {
    if (document.getElementById('wdDemoBarStyle')) return;
    const style = document.createElement('style');
    style.id = 'wdDemoBarStyle';
    style.textContent = `
      html, body {
        min-height: 100vh !important;
        height: auto !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
      }
      #webTransport {
        flex: 0 0 auto;
        width: 100%;
        background: #0d1017;
        border-bottom: 1px solid #1e2636;
        color: #e2e8f0;
        font: 500 11px/1.2 "Figtree", "Segoe UI", system-ui, sans-serif;
        padding: 7px 12px 6px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        z-index: 9999;
        user-select: none;
        -webkit-user-select: none;
      }
      #webTransport * { box-sizing: border-box; }
      #webTransport .wd-db-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      #webTransport .wd-db-tag {
        color: #38bdf8;
        font-weight: 800;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        margin-right: 2px;
      }
      #webTransport button,
      #webTransport a.wd-db-nav,
      #webTransport a.wd-db-dl {
        background: #141925;
        border: 1px solid #253044;
        border-radius: 4px;
        color: #cbd5e1;
        font: 600 10.5px/1 "Figtree", "Segoe UI", system-ui, sans-serif;
        padding: 5px 9px;
        cursor: pointer;
        text-decoration: none;
        letter-spacing: 0.04em;
        transition: border-color 0.12s, color 0.12s, background 0.12s;
      }
      #webTransport button:hover,
      #webTransport a.wd-db-nav:hover,
      #webTransport a.wd-db-dl:hover {
        border-color: #38bdf8;
        color: #f8fafc;
      }
      #webTransport button.on,
      #webTransport a.wd-db-nav.on {
        background: #38bdf8;
        border-color: #38bdf8;
        color: #08090d;
        font-weight: 700;
      }
      #webTransport .wd-db-stems {
        display: inline-flex;
        border: 1px solid #253044;
        border-radius: 4px;
        overflow: hidden;
        background: #10141e;
      }
      #webTransport .wd-db-stems button {
        border: 0;
        border-radius: 0;
        background: transparent;
        padding: 5px 8px;
      }
      #webTransport .wd-db-stems button + button {
        border-left: 1px solid #1e2636;
      }
      #webTransport .wd-db-bar {
        position: relative;
        flex: 1 1 130px;
        min-width: 110px;
        max-width: 240px;
        height: 22px;
        background: #080a0f;
        border: 1px solid #253044;
        border-radius: 4px;
        overflow: hidden;
        cursor: pointer;
      }
      #webTransport .wd-db-fill {
        position: absolute;
        inset: 0 auto 0 0;
        width: 0%;
        background: rgba(56, 189, 248, 0.22);
        pointer-events: none;
      }
      #webTransport .wd-db-head {
        position: absolute;
        top: 0; bottom: 0; left: 0%;
        width: 2px;
        background: #38bdf8;
        pointer-events: none;
      }
      #webTransport .wd-db-time {
        position: relative;
        z-index: 1;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding: 0 7px;
        font: 500 10px/1 "JetBrains Mono", Consolas, monospace;
        color: #94a3b8;
        pointer-events: none;
      }
      #webTransport .wd-db-vol {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: #94a3b8;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
      }
      #webTransport .wd-db-vol input {
        width: 68px;
        accent-color: #38bdf8;
      }
      #webTransport .wd-db-status {
        color: #94a3b8;
        font: 500 10.5px/1.2 "JetBrains Mono", Consolas, monospace;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 240px;
      }
      #webTransport .wd-db-navwrap {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
        flex: 1 1 auto;
      }
      #webTransport a.wd-db-nav {
        padding: 4px 7px;
        font-size: 10px;
      }
      #webTransport a.wd-db-dl {
        margin-left: auto;
        border-color: rgba(56, 189, 248, 0.45);
        color: #7dd3fc;
      }
    `;
    document.head.appendChild(style);
  }

  window.__WD_MOUNT_DEMO_BAR__ = function mountDemoBar(opts) {
    injectStyle();

    const activeSlug = opts.activeSlug || 'eq';
    const defaultStemKey = opts.defaultStem || 'Drums';
    const stemCache = new Map();
    let currentKey = defaultStemKey;
    let currentBuffer = null;
    let loopEnabled = true;
    let volValue = typeof opts.initialVolume === 'number' ? opts.initialVolume : 70;
    let isPlaying = false;
    let startAudioTime = 0;
    let startOffset = 0;
    let rafId = 0;
    let loadSeq = 0;

    const bar = document.createElement('div');
    bar.id = 'webTransport';

    const row1 = document.createElement('div');
    row1.className = 'wd-db-row';

    const tag = document.createElement('span');
    tag.className = 'wd-db-tag';
    tag.textContent = 'LIVE IN BROWSER';
    row1.appendChild(tag);

    const playBtn = document.createElement('button');
    playBtn.textContent = '\u25b6 PLAY';
    row1.appendChild(playBtn);

    const loopBtn = document.createElement('button');
    loopBtn.className = 'on';
    loopBtn.textContent = 'LOOP';
    row1.appendChild(loopBtn);

    const prog = document.createElement('div');
    prog.className = 'wd-db-bar';
    const progFill = document.createElement('div');
    progFill.className = 'wd-db-fill';
    const progHead = document.createElement('div');
    progHead.className = 'wd-db-head';
    const progTime = document.createElement('div');
    progTime.className = 'wd-db-time';
    progTime.textContent = '0:00 / 0:00';
    prog.append(progFill, progHead, progTime);
    row1.appendChild(prog);

    const stemsWrap = document.createElement('div');
    stemsWrap.className = 'wd-db-stems';
    const stemBtns = new Map();
    for (const s of STEMS) {
      const sb = document.createElement('button');
      sb.textContent = s.label;
      if (s.key === currentKey) sb.classList.add('on');
      sb.addEventListener('click', () => activateStem(s, true));
      stemsWrap.appendChild(sb);
      stemBtns.set(s.key, sb);
    }
    row1.appendChild(stemsWrap);

    const noiseBtn = document.createElement('button');
    noiseBtn.textContent = 'Pink Noise';
    row1.appendChild(noiseBtn);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.style.display = 'none';
    row1.appendChild(fileInput);

    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load Audio';
    loadBtn.addEventListener('click', () => fileInput.click());
    row1.appendChild(loadBtn);

    const volWrap = document.createElement('label');
    volWrap.className = 'wd-db-vol';
    volWrap.textContent = 'VOL';
    const volRange = document.createElement('input');
    volRange.type = 'range';
    volRange.min = '0';
    volRange.max = '100';
    volRange.value = String(volValue);
    volRange.addEventListener('input', () => {
      volValue = volRange.valueAsNumber;
      const g = Math.pow(volValue / 100, 2);
      if (opts.onVolumeChange) opts.onVolumeChange(g, volValue);
    });
    volWrap.appendChild(volRange);
    row1.appendChild(volWrap);

    const status = document.createElement('span');
    status.className = 'wd-db-status';
    status.textContent = 'Press Play (Space) or drop an audio file anywhere';
    row1.appendChild(status);

    const row2 = document.createElement('div');
    row2.className = 'wd-db-row';
    const navWrap = document.createElement('div');
    navWrap.className = 'wd-db-navwrap';
    for (const [slug, label] of PLUGINS) {
      const a = document.createElement('a');
      a.className = 'wd-db-nav' + (slug === activeSlug ? ' on' : '');
      a.href = `./${slug}.html`;
      a.textContent = label;
      navWrap.appendChild(a);
    }
    const dlLink = document.createElement('a');
    dlLink.className = 'wd-db-dl';
    dlLink.href = 'https://xbombjackx.itch.io/werewolf-digital';
    dlLink.target = '_blank';
    dlLink.rel = 'noopener';
    dlLink.textContent = 'Free VST3 / CLAP \u2192';
    row2.append(navWrap, dlLink);

    bar.append(row1, row2);

    const attach = () => {
      if (!document.getElementById('webTransport'))
        document.body.insertBefore(bar, document.body.firstChild);
    };
    if (document.body) attach();
    else document.addEventListener('DOMContentLoaded', attach);

    function markActiveButton(key) {
      for (const [k, btn] of stemBtns.entries())
        btn.classList.toggle('on', k === key);
      noiseBtn.classList.toggle('on', key === '__noise__');
    }

    function updateProgress() {
      if (!currentBuffer) {
        progFill.style.width = '0%';
        progHead.style.left = '0%';
        progTime.textContent = '0:00 / 0:00';
        return;
      }
      const dur = Math.max(0.001, currentBuffer.duration);
      let pos = startOffset;
      if (isPlaying && opts.getAudioContext) {
        const ctx = opts.getAudioContext();
        if (ctx) {
          const elapsed = Math.max(0, ctx.currentTime - startAudioTime);
          pos = loopEnabled ? (startOffset + elapsed) % dur : Math.min(dur, startOffset + elapsed);
        }
      }
      const frac = Math.max(0, Math.min(1, pos / dur));
      progFill.style.width = (frac * 100).toFixed(2) + '%';
      progHead.style.left = (frac * 100).toFixed(2) + '%';
      progTime.textContent = fmtTime(pos) + ' / ' + fmtTime(dur);
      if (isPlaying)
        rafId = requestAnimationFrame(updateProgress);
    }

    function setPlayingState(playing, offsetSec = 0) {
      isPlaying = !!playing;
      playBtn.textContent = isPlaying ? '\u25a0 STOP' : '\u25b6 PLAY';
      playBtn.classList.toggle('on', isPlaying);
      if (isPlaying) {
        const ctx = opts.getAudioContext ? opts.getAudioContext() : null;
        startAudioTime = ctx ? ctx.currentTime : 0;
        startOffset = offsetSec;
        if (!rafId) rafId = requestAnimationFrame(updateProgress);
      } else {
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        startOffset = 0;
        updateProgress();
      }
    }

    async function fetchStemBuffer(ctx, stem) {
      if (stemCache.has(stem.key)) return stemCache.get(stem.key);
      const urls = [`../audio/${stem.file}`, `./audio/${stem.file}`];
      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const bytes = await res.arrayBuffer();
          const decoded = await ctx.decodeAudioData(bytes);
          stemCache.set(stem.key, decoded);
          return decoded;
        } catch {
          // try next candidate
        }
      }
      const fb = synthFallbackBuffer(ctx, stem.key);
      stemCache.set(stem.key, fb);
      return fb;
    }

    async function activateStem(stem, autoPlay) {
      const seq = ++loadSeq;
      currentKey = stem.key;
      markActiveButton(stem.key);
      status.textContent = `Loading ${stem.label}...`;
      const ctx = await opts.getAudioContextAsync();
      const buf = await fetchStemBuffer(ctx, stem);
      if (seq !== loadSeq) return;
      currentBuffer = buf;
      startOffset = 0;
      status.textContent = `${stem.label} \u00b7 ${buf.duration.toFixed(1)}s \u00b7 live @ ${(ctx.sampleRate / 1000).toFixed(1)} kHz`;
      updateProgress();
      if (autoPlay) {
        await opts.onStartBuffer(buf, { offset: 0, loop: loopEnabled, volumeGain: Math.pow(volValue / 100, 2) });
        setPlayingState(true, 0);
      }
    }

    async function loadUserFile(file) {
      const seq = ++loadSeq;
      currentKey = '__file__';
      markActiveButton('__file__');
      status.textContent = `Decoding ${file.name}...`;
      const ctx = await opts.getAudioContextAsync();
      try {
        const bytes = await file.arrayBuffer();
        const decoded = await ctx.decodeAudioData(bytes);
        if (seq !== loadSeq) return;
        currentBuffer = decoded;
        startOffset = 0;
        status.textContent = `${file.name} \u00b7 ${decoded.duration.toFixed(1)}s`;
        await opts.onStartBuffer(decoded, { offset: 0, loop: loopEnabled, volumeGain: Math.pow(volValue / 100, 2) });
        setPlayingState(true, 0);
      } catch {
        status.textContent = `Could not decode "${file.name}"`;
      }
    }

    playBtn.addEventListener('click', async () => {
      if (isPlaying) {
        if (opts.onStop) opts.onStop();
        setPlayingState(false, 0);
        return;
      }
      if (currentBuffer) {
        await opts.getAudioContextAsync();
        await opts.onStartBuffer(currentBuffer, { offset: startOffset, loop: loopEnabled, volumeGain: Math.pow(volValue / 100, 2) });
        setPlayingState(true, startOffset);
        return;
      }
      const stem = STEMS.find(s => s.key === currentKey) || STEMS[0];
      await activateStem(stem, true);
    });

    loopBtn.addEventListener('click', () => {
      loopEnabled = !loopEnabled;
      loopBtn.classList.toggle('on', loopEnabled);
      if (opts.onLoopChange) opts.onLoopChange(loopEnabled);
    });

    noiseBtn.addEventListener('click', async () => {
      const seq = ++loadSeq;
      const ctx = await opts.getAudioContextAsync();
      if (seq !== loadSeq) return;
      if (currentKey === '__noise__' && isPlaying) {
        if (opts.onStop) opts.onStop();
        setPlayingState(false, 0);
        return;
      }
      currentKey = '__noise__';
      markActiveButton('__noise__');
      currentBuffer = pinkNoiseBuffer(ctx);
      status.textContent = `Pink Noise \u00b7 live @ ${(ctx.sampleRate / 1000).toFixed(1)} kHz`;
      await opts.onStartBuffer(currentBuffer, { offset: 0, loop: loopEnabled, volumeGain: Math.pow(volValue / 100, 2) });
      setPlayingState(true, 0);
    });

    prog.addEventListener('pointerdown', async ev => {
      if (!currentBuffer) return;
      const r = prog.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (ev.clientX - r.left) / Math.max(1, r.width)));
      const off = frac * currentBuffer.duration;
      startOffset = off;
      if (isPlaying) {
        await opts.onStartBuffer(currentBuffer, { offset: off, loop: loopEnabled, volumeGain: Math.pow(volValue / 100, 2) });
        setPlayingState(true, off);
      } else {
        updateProgress();
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) loadUserFile(fileInput.files[0]);
    });
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => {
      e.preventDefault();
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) loadUserFile(f);
    });

    window.addEventListener('keydown', ev => {
      if (ev.code !== 'Space') return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable))
        return;
      ev.preventDefault();
      playBtn.click();
    });

    return {
      onEndedNaturally() {
        if (!loopEnabled) setPlayingState(false, 0);
      },
      setPlaying(playing) {
        setPlayingState(playing, 0);
      },
      setStatus(text) {
        status.textContent = text;
      },
    };
  };
})();
