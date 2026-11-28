// ==========================================================================
// Werewolf Digital — Shared Precision Instrument Runtime Kit (/wd/kit.js)
// Provides:
//  - Global theme & settings sync (localStorage 'wd_theme' + native settings.json)
//  - WdRenderLoop (dt-normalized exponential ballistics + true idle sleep)
//  - Pull-paced binary telemetry client (/telemetry.bin -> Float32Array)
//  - Normalized deltaMode & coalesced precision trackpad wheel gestures
//  - Musical pitch ("A3", "C#4-15ct"), tempo ("1/8d"), and unit ("2.4k") parser
//  - Machined 3-tier knob enhancer, bipolar live modulation collars & lock badge
//  - Universal right-click parameter menu + Preset Lock
//  - Shared Top-Bar Preset Browser, A/B/C/D Snapshots, 2D XY Morph Pad & Undo/Redo
// ==========================================================================

(function () {
  'use strict';

  const SVGNS = 'http://www.w3.org/2000/svg';
  const ARC_R = 22;
  const LEN_FULL = 2 * Math.PI * ARC_R * 0.75; // 103.6725
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  let clipboardValue = null;
  let activeCtxMenu = null;
  let activePopover = null;
  let gradCounter = 0;

  function createAbortController() {
    const AC = (typeof window !== 'undefined' && typeof window.AbortController === 'function')
      ? window.AbortController
      : (typeof AbortController === 'function' ? AbortController : null);
    return AC ? new AC() : null;
  }

  function closeMenus() {
    if (activeCtxMenu) {
      activeCtxMenu.remove();
      activeCtxMenu = null;
    }
    if (activePopover) {
      activePopover.el.hidden = true;
      if (activePopover.onClose) activePopover.onClose();
      activePopover = null;
    }
  }

  window.addEventListener('pointerdown', ev => {
    if (activeCtxMenu && !activeCtxMenu.contains(ev.target)) {
      activeCtxMenu.remove();
      activeCtxMenu = null;
    }
    if (activePopover && !activePopover.el.contains(ev.target)
        && (!activePopover.trigger || !activePopover.trigger.contains(ev.target))) {
      activePopover.el.hidden = true;
      if (activePopover.onClose) activePopover.onClose();
      activePopover = null;
    }
  });

  // Attach on document (upstream of window in DOM bubble order) so Escape
  // cancels open menus/popovers BEFORE WebKeyForwarding.h's window listener runs.
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && (activeCtxMenu || activePopover)) {
      ev.preventDefault();
      closeMenus();
    }
  });

  // -----------------------------------------------------------------------
  // 1. Musical, Tempo & Unit Expression Parser
  // -----------------------------------------------------------------------
  let liveHostBpm = 120.0;

  function setHostBpm(bpm) {
    if (typeof bpm === 'number' && isFinite(bpm) && bpm >= 10.0 && bpm <= 999.0)
      liveHostBpm = bpm;
  }

  function getHostBpm() {
    return liveHostBpm;
  }

  const NOTE_OFFSETS = {
    c: 0, 'c#': 1, db: 1, d: 2, 'd#': 3, eb: 3, e: 4, f: 5,
    'f#': 6, gb: 6, g: 7, 'g#': 8, ab: 8, a: 9, 'a#': 10, bb: 10, b: 11
  };

  function parseMusicalValue(rawInput, opts = {}) {
    if (typeof rawInput !== 'string') return NaN;
    const raw = rawInput.trim();
    if (!raw) return NaN;

    // 1) Musical note expression: e.g. "A3" -> 220 Hz, "C#4 - 15ct", "Bb2+10"
    const noteMatch = raw.match(/^([A-Ga-g][#b]?)(-?\d)(?:\s*([+-]\s*\d+(?:\.\d+)?)\s*(?:ct|cents?)?)?$/);
    if (noteMatch) {
      const key = noteMatch[1].toLowerCase();
      const oct = parseInt(noteMatch[2], 10);
      const cents = noteMatch[3] ? parseFloat(noteMatch[3].replace(/\s+/g, '')) : 0;
      if (Object.prototype.hasOwnProperty.call(NOTE_OFFSETS, key) && isFinite(oct)) {
        const midi = (oct + 1) * 12 + NOTE_OFFSETS[key] + (isFinite(cents) ? cents / 100.0 : 0);
        return 440.0 * Math.pow(2.0, (midi - 69.0) / 12.0);
      }
    }

    // 2) Tempo note division -> milliseconds: e.g. "1/4", "1/8d", "1/16t"
    const tempoMatch = raw.match(/^(\d+)\s*\/\s*(\d+)\s*([dtDT])?$/);
    if (tempoMatch) {
      const num = parseFloat(tempoMatch[1]);
      const den = parseFloat(tempoMatch[2]);
      const mod = (tempoMatch[3] || '').toLowerCase();
      const bpm = (opts && opts.bpm > 10) ? opts.bpm : liveHostBpm;
      if (den > 0 && num > 0) {
        let beats = (4.0 * num) / den;
        if (mod === 'd') beats *= 1.5;
        else if (mod === 't') beats *= (2.0 / 3.0);
        return (60000.0 / bpm) * beats;
      }
    }

    // 3) 'k' / 'kHz' suffix multiplier (1000x) and 's' seconds -> ms when unit is ms
    if (/k(?:hz)?\s*$/i.test(raw)) {
      const base = parseFloat(raw.replace(/k(?:hz)?\s*$/i, '').replace(/[^0-9.+\-eE]/g, ''));
      return isFinite(base) ? base * 1000.0 : NaN;
    }
    if (opts && opts.unit === 'ms' && /\d\s*s\s*$/i.test(raw) && !/ms\s*$/i.test(raw)) {
      const secs = parseFloat(raw.replace(/s\s*$/i, '').replace(/[^0-9.+\-eE]/g, ''));
      return isFinite(secs) ? secs * 1000.0 : NaN;
    }

    const plain = parseFloat(raw.replace(/[^0-9.+\-eE]/g, ''));
    return plain;
  }

  // -----------------------------------------------------------------------
  // 2. Normalized Wheel & Coalesced Precision Trackpad Gesture Helper
  // -----------------------------------------------------------------------
  function normalizeWheelDelta(ev) {
    let dy = ev.deltaY || 0;
    if (ev.deltaMode === 1) dy *= 40;
    else if (ev.deltaMode === 2) dy *= 120;
    return dy;
  }

  function attachWheelGesture(el, getSlider, applyStepFn, signal) {
    if (!el) return;
    let wheelGestureOpen = false;
    let wheelTimer = null;
    const evOpts = signal ? { signal } : undefined;
    const wheelOpts = signal ? { passive: false, signal } : { passive: false };

    const closeGesture = () => {
      if (wheelTimer) {
        clearTimeout(wheelTimer);
        wheelTimer = null;
      }
      if (wheelGestureOpen) {
        wheelGestureOpen = false;
        const s = getSlider();
        if (s && typeof s.sliderDragEnded === 'function') s.sliderDragEnded();
      }
    };

    el.addEventListener('pointerdown', closeGesture, evOpts);
    window.addEventListener('blur', closeGesture, evOpts);
    window.addEventListener('pagehide', closeGesture, evOpts);

    el.addEventListener('wheel', ev => {
      const slider = getSlider();
      if (!slider) return;
      if (el.classList && (el.classList.contains('disabled') || el.classList.contains('na') || el.getAttribute('aria-disabled') === 'true'))
        return;

      ev.preventDefault();
      const dyPx = normalizeWheelDelta(ev);
      if (dyPx === 0) return;

      const fine = ev.shiftKey ? 0.1 : 1.0;
      const isDiscreteDetent = (ev.deltaMode !== 0) || (Math.abs(ev.deltaY) >= 100);

      if (isDiscreteDetent) {
        closeGesture();
        const dir = dyPx < 0 ? 1 : -1;
        const stepNorm = (dir * fine) / 100.0;
        slider.sliderDragStarted();
        applyStepFn(slider, stepNorm, ev);
        slider.sliderDragEnded();
      } else {
        // Precision trackpad pixel stream (< 100 px): coalesce into one host gesture
        const fracNotch = clamp(-dyPx / 120.0, -2.0, 2.0);
        const stepNorm = (fracNotch * fine) / 100.0;
        if (!wheelGestureOpen) {
          wheelGestureOpen = true;
          slider.sliderDragStarted();
        }
        applyStepFn(slider, stepNorm, ev);
        if (wheelTimer) clearTimeout(wheelTimer);
        wheelTimer = setTimeout(closeGesture, 180);
      }
    }, wheelOpts);
  }

  // -----------------------------------------------------------------------
  // 3. WdRenderLoop (dt-normalized ballistics + true idle sleep)
  // -----------------------------------------------------------------------
  function expBallistic(current, target, dtMs, attackMs, releaseMs) {
    if (!isFinite(current)) return target;
    if (!isFinite(target)) return current;
    const tau = Math.max(0.5, target > current ? attackMs : releaseMs);
    const alpha = 1.0 - Math.exp(-clamp(dtMs, 0.5, 100.0) / tau);
    return current + (target - current) * alpha;
  }

  function createRenderLoop(frameCallback) {
    let rafId = 0;
    let lastTs = 0;
    let settleFrames = 0;

    function tick(ts) {
      rafId = 0;
      const dtMs = lastTs > 0 ? clamp(ts - lastTs, 0.5, 100.0) : 16.67;
      lastTs = ts;
      const keepAlive = frameCallback(dtMs, ts);
      if (keepAlive) {
        settleFrames = 12;
        rafId = requestAnimationFrame(tick);
      } else if (settleFrames > 0) {
        --settleFrames;
        rafId = requestAnimationFrame(tick);
      } else {
        lastTs = 0;
      }
    }

    return {
      wake() {
        settleFrames = Math.max(settleFrames, 4);
        if (!rafId && !document.hidden)
          rafId = requestAnimationFrame(tick);
      },
      stop() {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
        lastTs = 0;
      }
    };
  }

  // -----------------------------------------------------------------------
  // 4. Pull-Paced Binary Telemetry Client (/telemetry.bin)
  // -----------------------------------------------------------------------
  function createTelemetryPoller(onPacket, intervalMs = 16) {
    if (window.__WD_WEB_HOST__) {
      if (typeof window.__WD_WEB_HOST__.createTelemetryPoller === 'function')
        return window.__WD_WEB_HOST__.createTelemetryPoller(onPacket, intervalMs);
      return { start() {}, stop() {} };
    }
    if (typeof window.fetch !== 'function')
      return { start() {}, stop() {} };

    let active = false;
    let inFlight = false;
    let rafId = 0;
    let lastPullTs = 0;
    let lastSeq = 0;
    let consecutiveMisses = 0;

    function loop(ts) {
      if (!active) return;
      rafId = requestAnimationFrame(loop);
      if (document.hidden || inFlight || (ts - lastPullTs) < intervalMs)
        return;

      lastPullTs = ts;
      inFlight = true;
      window.fetch('/telemetry.bin', { cache: 'no-store' })
        .then(res => (res && res.ok ? res.arrayBuffer() : null))
        .then(buf => {
          inFlight = false;
          if (!buf || buf.byteLength < 24) {
            if (++consecutiveMisses > 8) active = false;
            return;
          }
          consecutiveMisses = 0;
          const u32 = new Uint32Array(buf, 0, 6);
          if (u32[0] !== 0x57445442 || u32[1] !== 1) return;
          const kind = u32[2];
          const flags = u32[3];
          const seq = u32[4];
          const count = u32[5];
          if (seq === 0 || seq === lastSeq) return;
          if (24 + count * 4 > buf.byteLength) return;
          lastSeq = seq;
          const floats = new Float32Array(buf, 24, count);
          onPacket({ kind, flags, seq, floats });
        })
        .catch(() => {
          inFlight = false;
          if (++consecutiveMisses > 4) active = false;
        });
    }

    const onVis = () => {
      if (!document.hidden && active && !rafId)
        rafId = requestAnimationFrame(loop);
    };
    document.addEventListener('visibilitychange', onVis);

    return {
      start() {
        if (active) return;
        active = true;
        consecutiveMisses = 0;
        if (!rafId) rafId = requestAnimationFrame(loop);
      },
      stop() {
        active = false;
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
      }
    };
  }

  // -----------------------------------------------------------------------
  // 5. Machined Rotary Dial Upgrade, Modulation Collars, Locks & Context Menu
  // -----------------------------------------------------------------------
  const ARC_FULL = 'M12.44 43.56 A22 22 0 1 1 43.56 43.56';
  const ARC_UP   = 'M28 6 A22 22 0 0 1 43.56 43.56';
  const ARC_DOWN = 'M28 6 A22 22 0 0 0 12.44 43.56';
  const LEN_HALF = LEN_FULL / 2;

  function arcPoint(norm, radius = ARC_R) {
    const deg = -135 + clamp(norm, 0, 1) * 270;
    const rad = (deg - 90) * (Math.PI / 180);
    return { x: 28 + Math.cos(rad) * radius, y: 28 + Math.sin(rad) * radius };
  }

  function describeArc(n0, n1, radius = ARC_R) {
    const a = clamp(Math.min(n0, n1), 0, 1);
    const b = clamp(Math.max(n0, n1), 0, 1);
    if (b - a < 0.002) return '';
    const p0 = arcPoint(a, radius);
    const p1 = arcPoint(b, radius);
    const sweepDeg = (b - a) * 270;
    const largeArc = sweepDeg > 180 ? 1 : 0;
    return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }

  let lockToggleHandler = null;
  const lockedParamSet = new Set();

  function syncAllLockBadges() {
    document.querySelectorAll('.knob[data-param-id]').forEach(el => {
      const pid = el.dataset.paramId;
      el.classList.toggle('wd-locked', lockedParamSet.has(pid));
    });
  }

  function ensureModGroups(svg) {
    if (!svg) return;
    if (!svg.querySelector('.kmod-multi')) {
      const g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', 'kmod-multi');
      svg.appendChild(g);
    }
    if (!svg.querySelector('.kmod-arc')) {
      const modArc = document.createElementNS(SVGNS, 'path');
      modArc.setAttribute('class', 'kmod-arc');
      modArc.setAttribute('fill', 'none');
      modArc.setAttribute('stroke', 'var(--cyan, #00d2ff)');
      modArc.setAttribute('stroke-width', '2.6');
      modArc.setAttribute('stroke-linecap', 'round');
      modArc.style.display = 'none';

      const modDot = document.createElementNS(SVGNS, 'circle');
      modDot.setAttribute('class', 'kmod-dot');
      modDot.setAttribute('r', '2.3');
      modDot.setAttribute('fill', '#ffffff');
      modDot.setAttribute('stroke', 'var(--cyan, #00d2ff)');
      modDot.setAttribute('stroke-width', '1.2');
      modDot.style.display = 'none';

      svg.append(modArc, modDot);
    }
    if (!svg.querySelector('.kmod-live-dot')) {
      const liveDot = document.createElementNS(SVGNS, 'circle');
      liveDot.setAttribute('class', 'kmod-live-dot');
      liveDot.setAttribute('r', '2.6');
      liveDot.setAttribute('fill', '#ffffff');
      liveDot.setAttribute('stroke', 'var(--cyan, #00d2ff)');
      liveDot.setAttribute('stroke-width', '1.3');
      liveDot.style.display = 'none';
      svg.appendChild(liveDot);
    }
  }

  function upgradeKnobVisuals(el) {
    if (!el || el.dataset.wdUpgraded === '1') return;
    const svg = el.querySelector('svg');
    if (!svg) return;
    el.dataset.wdUpgraded = '1';

    // Upgrade flat cap circle to machined linearGradient depth if not already using a gradient
    const circles = svg.querySelectorAll('circle');
    if (circles.length > 0) {
      const innerCap = circles[circles.length - 1];
      const fill = innerCap.getAttribute('fill') || '';
      if (!fill.startsWith('url(')) {
        const gid = 'wd_kcap_' + (++gradCounter);
        let defs = svg.querySelector('defs');
        if (!defs) {
          defs = document.createElementNS(SVGNS, 'defs');
          svg.insertBefore(defs, svg.firstChild);
        }
        const lg = document.createElementNS(SVGNS, 'linearGradient');
        lg.setAttribute('id', gid);
        lg.setAttribute('x1', '0%'); lg.setAttribute('y1', '0%');
        lg.setAttribute('x2', '0%'); lg.setAttribute('y2', '100%');
        const s1 = document.createElementNS(SVGNS, 'stop');
        s1.setAttribute('offset', '0%');
        s1.setAttribute('stop-color', 'var(--knob-cap-top, var(--panel-hi, #232836))');
        const s2 = document.createElementNS(SVGNS, 'stop');
        s2.setAttribute('offset', '100%');
        s2.setAttribute('stop-color', 'var(--knob-cap-bot, var(--panel, #141720))');
        lg.append(s1, s2);
        defs.appendChild(lg);
        innerCap.setAttribute('fill', `url(#${gid})`);
      }
    }

    ensureModGroups(svg);

    if (!el.querySelector('.klock-badge')) {
      const badge = document.createElement('span');
      badge.className = 'klock-badge';
      badge.textContent = 'LOCK';
      badge.title = 'Parameter locked across preset & morph changes';
      el.appendChild(badge);
    }

    el.setAttribute('role', 'slider');
    if (el.dataset.label) el.setAttribute('aria-label', el.dataset.label);
  }

  function paintKnob(el, norm) {
    if (!el) return;
    const arc = el.querySelector('.karc');
    const needle = el.querySelector('.kneedle');
    if (!arc || !needle) return;
    const n = clamp(isFinite(norm) ? norm : 0, 0, 1);
    if (el.dataset.bipolar === '1') {
      const p = (n - 0.5) * 2;
      arc.setAttribute('d', p >= 0 ? ARC_UP : ARC_DOWN);
      arc.setAttribute('stroke-dashoffset', String(LEN_HALF * (1 - Math.abs(p))));
    } else {
      arc.setAttribute('stroke-dashoffset', String(LEN_FULL * (1 - n)));
    }
    needle.setAttribute('transform', 'rotate(' + (-135 + n * 270).toFixed(2) + ' 28 28)');
  }

  function mountKnob(el, opts = {}) {
    if (!el) return el;
    const size = parseInt(opts.size !== undefined ? opts.size : (el.dataset.size || '56'), 10);
    const bipolar = opts.bipolar !== undefined ? !!opts.bipolar : (el.dataset.bipolar === '1');
    if (opts.bipolar !== undefined) el.dataset.bipolar = bipolar ? '1' : '0';
    if (opts.size !== undefined) el.dataset.size = String(size);
    if (opts.paramId !== undefined) el.dataset.paramId = opts.paramId;
    if (opts.destId !== undefined) el.dataset.destId = String(opts.destId);

    const colorRole = opts.color || el.dataset.color || 'accent';
    const arcStroke = colorRole === 'cyan'  ? 'var(--cyan)'
                    : colorRole === 'amber' ? 'var(--amber)'
                    : 'var(--accent)';
    const labelText = opts.label !== undefined ? opts.label : (el.dataset.label || '');
    if (opts.label !== undefined) el.dataset.label = labelText;
    const isSmall = opts.small !== undefined ? !!opts.small : el.classList.contains('sm');
    const sw = size < 48 ? 5.5 : 4.5;

    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 56 56');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));

    const gid = 'wd_kcap_' + (++gradCounter);
    const defs = document.createElementNS(SVGNS, 'defs');
    const lg = document.createElementNS(SVGNS, 'linearGradient');
    lg.setAttribute('id', gid);
    lg.setAttribute('x1', '0%'); lg.setAttribute('y1', '0%');
    lg.setAttribute('x2', '0%'); lg.setAttribute('y2', '100%');
    const s1 = document.createElementNS(SVGNS, 'stop');
    s1.setAttribute('offset', '0%');
    s1.setAttribute('stop-color', 'var(--knob-cap-top, var(--panel-hi, #232836))');
    const s2 = document.createElementNS(SVGNS, 'stop');
    s2.setAttribute('offset', '100%');
    s2.setAttribute('stop-color', 'var(--knob-cap-bot, var(--panel, #141720))');
    lg.append(s1, s2);
    defs.appendChild(lg);
    svg.appendChild(defs);

    if (size >= 48) {
      const ticks = document.createElementNS(SVGNS, 'g');
      for (let i = 0; i <= 10; i++) {
        const deg = -135 + i * 27;
        const rad = (deg - 90) * Math.PI / 180;
        const major = (i === 0 || i === 5 || i === 10);
        const r1 = 24.0;
        const r2 = major ? 26.2 : 25.3;
        const t = document.createElementNS(SVGNS, 'line');
        t.setAttribute('x1', (28 + Math.cos(rad) * r1).toFixed(2));
        t.setAttribute('y1', (28 + Math.sin(rad) * r1).toFixed(2));
        t.setAttribute('x2', (28 + Math.cos(rad) * r2).toFixed(2));
        t.setAttribute('y2', (28 + Math.sin(rad) * r2).toFixed(2));
        t.setAttribute('stroke', major ? 'var(--label)' : 'var(--muted)');
        t.setAttribute('stroke-width', major ? '1.3' : '0.9');
        t.setAttribute('stroke-linecap', 'round');
        t.setAttribute('opacity', major ? '0.75' : '0.42');
        ticks.appendChild(t);
      }
      svg.appendChild(ticks);
    }

    const mk = (d, stroke, width) => {
      const p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', stroke);
      p.setAttribute('stroke-width', String(width));
      p.setAttribute('stroke-linecap', 'round');
      return p;
    };
    const track = mk(ARC_FULL, 'var(--track)', sw);
    const arc = mk(bipolar ? ARC_UP : ARC_FULL, arcStroke, sw);
    arc.setAttribute('stroke-dasharray', String(bipolar ? LEN_HALF : LEN_FULL));
    arc.setAttribute('stroke-dashoffset', String(bipolar ? LEN_HALF : LEN_FULL));
    arc.classList.add('karc');
    svg.append(track, arc);

    if (bipolar) {
      const tick = document.createElementNS(SVGNS, 'line');
      tick.setAttribute('x1', '28'); tick.setAttribute('y1', '3.5');
      tick.setAttribute('x2', '28'); tick.setAttribute('y2', '8.2');
      tick.setAttribute('stroke', 'var(--label)');
      tick.setAttribute('stroke-width', '1.5');
      tick.setAttribute('stroke-linecap', 'round');
      svg.appendChild(tick);
    }

    const collar = document.createElementNS(SVGNS, 'circle');
    collar.setAttribute('cx', '28'); collar.setAttribute('cy', '28');
    collar.setAttribute('r', size < 48 ? '15.2' : '16.8');
    collar.setAttribute('fill', 'rgba(0, 0, 0, 0.35)');
    collar.setAttribute('stroke', 'var(--line)');
    svg.appendChild(collar);

    const cap = document.createElementNS(SVGNS, 'circle');
    cap.setAttribute('cx', '28'); cap.setAttribute('cy', '28');
    cap.setAttribute('r', size < 48 ? '13.4' : '14.6');
    cap.setAttribute('fill', `url(#${gid})`);
    cap.setAttribute('stroke', 'var(--line-hi)');
    svg.appendChild(cap);

    const needle = document.createElementNS(SVGNS, 'line');
    needle.setAttribute('x1', '28'); needle.setAttribute('y1', size < 48 ? '15.5' : '14.6');
    needle.setAttribute('x2', '28'); needle.setAttribute('y2', '21.2');
    needle.setAttribute('stroke', 'var(--text)');
    needle.setAttribute('stroke-width', size < 48 ? '2.6' : '2.4');
    needle.setAttribute('stroke-linecap', 'round');
    needle.classList.add('kneedle');
    svg.appendChild(needle);

    ensureModGroups(svg);

    const lab = document.createElement('div');
    lab.className = 'klabel';
    lab.textContent = labelText;
    const val = document.createElement('span');
    val.className = 'v';
    val.textContent = '—';

    const badge = document.createElement('span');
    badge.className = 'klock-badge';
    badge.textContent = 'LOCK';
    badge.title = 'Parameter locked across preset & morph changes';

    el.innerHTML = '';
    if (isSmall) {
      const stack = document.createElement('div');
      stack.className = 'kstack';
      stack.append(lab, val);
      el.append(svg, stack, badge);
    } else {
      el.append(lab, svg, val, badge);
    }

    el.dataset.wdUpgraded = '1';
    el.setAttribute('role', 'slider');
    if (labelText) el.setAttribute('aria-label', labelText);
    paintKnob(el, bipolar ? 0.5 : 0);

    if (opts.slider) {
      bindSliderKnob(el, opts.slider, opts);
    }
    return el;
  }

  function bindSliderKnob(el, slider, opts = {}) {
    if (!el || !slider) return el;

    // Abort previous listeners cleanly without cloneNode(true) so SVG mod nodes and patch-cord targets persist.
    if (el._wdBindAbort) el._wdBindAbort.abort();
    if (el._wdBoundSlider && el._wdValListener) {
      try { el._wdBoundSlider.valueChangedEvent.removeListener(el._wdValListener); } catch (_) {}
    }

    const ac = createAbortController();
    el._wdBindAbort = ac;
    const sig = ac ? ac.signal : undefined;
    const evOpts = sig ? { signal: sig } : undefined;

    if (opts.paramId) el.dataset.paramId = opts.paramId;
    else if (!el.dataset.paramId && el.id && el.id.startsWith('param_')) el.dataset.paramId = el.id.slice(6);

    const fmt = typeof opts.fmt === 'function' ? opts.fmt : (v => Number(v).toFixed(2));
    const onValueChange = typeof opts.onValueChange === 'function' ? opts.onValueChange : null;
    const span = el.querySelector('.v');

    const toNorm = scaled => {
      const p = slider.properties || { start: 0, end: 1, skew: 1 };
      const spanRange = (p.end - p.start) || 1;
      const lin = clamp((scaled - p.start) / spanRange, 0, 1);
      const skew = (isFinite(p.skew) && p.skew > 0) ? p.skew : 1;
      return Math.pow(lin, skew);
    };

    const updateDisplay = () => {
      const v = slider.getScaledValue();
      if (span && span.isConnected) span.textContent = fmt(v);
      paintKnob(el, slider.getNormalisedValue());
      if (onValueChange) onValueChange(v);
    };

    if (slider.customListener) {
      try { slider.valueChangedEvent.removeListener(slider.customListener); } catch (_) {}
    }
    slider.customListener = updateDisplay;
    el._wdBoundSlider = slider;
    el._wdValListener = updateDisplay;
    slider.valueChangedEvent.addListener(updateDisplay);
    updateDisplay();

    // Click-to-type numeric entry on .v (P2-04: supports '0.05k', 'A3', '1/8d', etc.)
    if (span) {
      span.addEventListener('pointerdown', ev => {
        ev.stopPropagation();
      }, evOpts);

      span.addEventListener('click', ev => {
        ev.stopPropagation();
        if (el.classList.contains('disabled') || el.classList.contains('auto-on')
            || el.classList.contains('na') || el.getAttribute('aria-disabled') === 'true') {
          return;
        }
        if (el.querySelector('input.v-edit')) return;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'v-edit value-entry';
        input.value = String(Number(slider.getScaledValue().toFixed(3)));
        span.style.display = 'none';
        el.appendChild(input);
        input.focus({ preventScroll: true });
        input.select();

        let committed = false;
        const commit = apply => {
          if (committed) return;
          committed = true;
          if (apply) {
            const parsed = parseMusicalValue(input.value, opts);
            if (isFinite(parsed)) {
              const p = slider.properties || { start: 0, end: 1 };
              const lo = isFinite(p.start) ? p.start : -1e9;
              const hi = isFinite(p.end) ? p.end : 1e9;
              const clamped = clamp(parsed, Math.min(lo, hi), Math.max(lo, hi));
              slider.sliderDragStarted();
              slider.setNormalisedValue(toNorm(clamped));
              slider.sliderDragEnded();
            }
          }
          input.remove();
          span.style.display = '';
          updateDisplay();
        };
        input.addEventListener('keydown', kev => {
          kev.stopPropagation();
          if (kev.key === 'Enter') { kev.preventDefault(); commit(true); }
          else if (kev.key === 'Escape') { kev.preventDefault(); commit(false); }
        });
        input.addEventListener('blur', () => commit(true));
      }, evOpts);
    }

    el.addEventListener('dblclick', ev => {
      if (span && ev.target === span) return;
      if (el.classList.contains('disabled') || el.classList.contains('na') || el.getAttribute('aria-disabled') === 'true')
        return;
      ev.preventDefault();
      const def = (slider.properties || {}).defaultValue;
      if (typeof def !== 'number') return;
      slider.sliderDragStarted();
      slider.setNormalisedValue(toNorm(def));
      slider.sliderDragEnded();
      updateDisplay();
    }, evOpts);

    let dragState = null;
    el.addEventListener('pointerdown', ev => {
      if ((ev.button ?? 0) !== 0) return;
      if ((span && ev.target === span) || (ev.target && ev.target.tagName === 'INPUT')) return;
      if (el.classList.contains('disabled') || el.classList.contains('auto-on')
          || el.classList.contains('na') || el.getAttribute('aria-disabled') === 'true') {
        return;
      }
      dragState = { y: ev.clientY, n: slider.getNormalisedValue() };
      slider.sliderDragStarted();
      el.classList.add('dragging');
      try { el.setPointerCapture(ev.pointerId); } catch (_) {}
      ev.preventDefault();
    }, evOpts);

    el.addEventListener('pointermove', ev => {
      if (!dragState) return;
      const fine = ev.shiftKey ? (opts.fineScale || 0.1) : 1.0;
      const delta = (dragState.y - ev.clientY) * fine / 250.0;
      slider.setNormalisedValue(clamp(dragState.n + delta, 0, 1));
      updateDisplay();
    }, evOpts);

    const endDrag = ev => {
      if (dragState) {
        slider.sliderDragEnded();
        dragState = null;
      }
      el.classList.remove('dragging');
      try { el.releasePointerCapture(ev.pointerId); } catch (_) {}
    };
    el.addEventListener('pointerup', endDrag, evOpts);
    el.addEventListener('pointercancel', endDrag, evOpts);

    attachWheelGesture(el, () => slider, (s, stepNorm) => {
      s.setNormalisedValue(clamp(s.getNormalisedValue() + stepNorm, 0, 1));
      updateDisplay();
    }, sig);

    attachKnobContextMenu(el, () => slider, sig);
    syncAllLockBadges();
    return el;
  }

  function scaledDeltaToNorm(slider, baseScaled, deltaScaled) {
    if (!slider || !isFinite(deltaScaled) || Math.abs(deltaScaled) < 1e-9) return 0;
    const p = slider.properties || { start: 0, end: 1, skew: 1 };
    const span = p.end - p.start;
    if (!isFinite(span) || Math.abs(span) < 1e-12) return 0;
    const skew = (isFinite(p.skew) && p.skew > 0) ? p.skew : 1;
    const toN = v => Math.pow(clamp((v - p.start) / span, 0, 1), skew);
    return toN(baseScaled + deltaScaled) - toN(baseScaled);
  }

  function setKnobModulationSources(el, baseNorm, sources) {
    if (!el) return;
    upgradeKnobVisuals(el);
    const svg = el.querySelector('svg');
    if (!svg) return;
    ensureModGroups(svg);
    const multiGroup = svg.querySelector('.kmod-multi');
    const liveDot = svg.querySelector('.kmod-live-dot');
    if (!multiGroup || !liveDot) return;

    if (!el._kmodPool) el._kmodPool = [];
    const pool = el._kmodPool;

    const list = Array.isArray(sources) ? sources : [];
    const base = clamp(isFinite(baseNorm) ? baseNorm : 0, 0, 1);

    let posCur = base;
    let negCur = base;
    let netOffset = 0;
    let maxMag = 0;
    let dominantColor = 'var(--cyan, #00d2ff)';
    let pathCount = 0;

    for (let i = 0; i < list.length; ++i) {
      const s = list[i];
      if (!s || !isFinite(s.offsetNorm) || Math.abs(s.offsetNorm) < 0.001) continue;
      const off = s.offsetNorm;
      netOffset += off;
      const color = s.color || 'var(--cyan, #00d2ff)';
      if (Math.abs(off) >= maxMag) {
        maxMag = Math.abs(off);
        dominantColor = color;
      }

      let a = base;
      let b = base;
      if (off > 0) {
        a = posCur;
        b = clamp(posCur + off, 0, 1);
        posCur = b;
      } else {
        a = negCur;
        b = clamp(negCur + off, 0, 1);
        negCur = b;
      }
      const d = describeArc(a, b, 24.4);
      if (!d) continue;

      let p = pool[pathCount];
      if (!p) {
        p = document.createElementNS(SVGNS, 'path');
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke-width', '2.5');
        p.setAttribute('stroke-linecap', 'round');
        p.style.pointerEvents = 'none';
        pool.push(p);
        multiGroup.appendChild(p);
      }
      p.setAttribute('d', d);
      p.setAttribute('stroke', color);
      p.style.display = '';
      pathCount++;
    }

    for (let i = pathCount; i < pool.length; ++i) {
      pool[i].style.display = 'none';
    }

    if (pathCount === 0 && Math.abs(netOffset) < 0.001) {
      liveDot.style.display = 'none';
      return;
    }

    const liveNorm = clamp(base + netOffset, 0, 1);
    const pt = arcPoint(liveNorm, 24.4);
    liveDot.setAttribute('cx', pt.x.toFixed(2));
    liveDot.setAttribute('cy', pt.y.toFixed(2));
    liveDot.setAttribute('stroke', dominantColor);
    liveDot.style.display = '';
  }

  function setKnobModulation(el, baseNorm, modOffsetNorm, colorCss) {
    if (!el) return;
    upgradeKnobVisuals(el);
    const modArc = el.querySelector('.kmod-arc');
    const modDot = el.querySelector('.kmod-dot');
    if (!modArc || !modDot) return;

    if (!isFinite(modOffsetNorm) || Math.abs(modOffsetNorm) < 0.002) {
      modArc.style.display = 'none';
      modDot.style.display = 'none';
      return;
    }
    const b = clamp(baseNorm, 0, 1);
    const live = clamp(b + modOffsetNorm, 0, 1);
    const d = describeArc(b, live, 24.4);
    if (!d) {
      modArc.style.display = 'none';
      modDot.style.display = 'none';
      return;
    }
    const stroke = colorCss || 'var(--cyan, #00d2ff)';
    modArc.setAttribute('d', d);
    modArc.setAttribute('stroke', stroke);
    modArc.style.display = '';

    const pt = arcPoint(live, 24.4);
    modDot.setAttribute('cx', pt.x.toFixed(2));
    modDot.setAttribute('cy', pt.y.toFixed(2));
    modDot.setAttribute('stroke', stroke);
    modDot.style.display = '';
  }

  function attachKnobContextMenu(el, getSlider, signal) {
    if (!el) return;
    el._wdCtxGetSlider = getSlider;
    if (el.dataset.wdCtxBound === '1') return;
    el.dataset.wdCtxBound = '1';

    el.addEventListener('contextmenu', ev => {
      const slider = el._wdCtxGetSlider ? el._wdCtxGetSlider() : null;
      if (!slider) return;
      ev.preventDefault();
      ev.stopPropagation();
      closeMenus();

      const pid = el.dataset.paramId || '';
      const p = slider.properties || { start: 0, end: 1, skew: 1, defaultValue: 0 };
      const toNorm = v => {
        const cl = clamp(v, p.start, p.end);
        const lin = (cl - p.start) / ((p.end - p.start) || 1);
        return Math.pow(clamp(lin, 0, 1), p.skew || 1);
      };

      const menu = document.createElement('div');
      menu.className = 'wd-ctx-menu';

      const addItem = (label, shortcut, fn, disabled = false) => {
        const b = document.createElement('button');
        b.disabled = disabled;
        const l = document.createElement('span');
        l.textContent = label;
        const r = document.createElement('span');
        r.style.opacity = '0.6';
        r.style.fontSize = '10px';
        r.textContent = shortcut || '';
        b.append(l, r);
        b.addEventListener('click', () => {
          closeMenus();
          fn();
        });
        menu.appendChild(b);
      };

      addItem('Reset to Default', 'Dbl-Click', () => {
        if (typeof p.defaultValue === 'number') {
          slider.sliderDragStarted();
          slider.setNormalisedValue(toNorm(p.defaultValue));
          slider.sliderDragEnded();
        }
      });

      const vSpan = el.querySelector('.v');
      if (vSpan) {
        addItem('Enter Exact Value…', 'Click', () => {
          vSpan.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
        });
      }

      const sep1 = document.createElement('div');
      sep1.className = 'wd-ctx-sep';
      menu.appendChild(sep1);

      addItem('Copy Value', '', () => {
        clipboardValue = slider.getScaledValue();
      });

      addItem('Paste Value', '', () => {
        if (clipboardValue !== null && isFinite(clipboardValue)) {
          slider.sliderDragStarted();
          slider.setNormalisedValue(toNorm(clipboardValue));
          slider.sliderDragEnded();
        }
      }, clipboardValue === null);

      if (pid && lockToggleHandler) {
        const sep2 = document.createElement('div');
        sep2.className = 'wd-ctx-sep';
        menu.appendChild(sep2);
        const isLocked = lockedParamSet.has(pid);
        addItem(isLocked ? 'Unlock Parameter' : 'Lock Across Presets', isLocked ? 'ON' : '', () => {
          lockToggleHandler(pid, !isLocked);
        });
      }

      document.body.appendChild(menu);
      const rect = menu.getBoundingClientRect();
      const left = clamp(ev.clientX, 6, Math.max(6, window.innerWidth - rect.width - 6));
      const top = clamp(ev.clientY, 6, Math.max(6, window.innerHeight - rect.height - 6));
      menu.style.left = left + 'px';
      menu.style.top = top + 'px';
      activeCtxMenu = menu;
    });
  }

  // Automatically enhance all .knob elements once bound
  function enhanceAllKnobs(sliderLookupFn) {
    document.querySelectorAll('.knob').forEach(el => {
      if (el.classList.contains('knobs')) return;
      upgradeKnobVisuals(el);
      const pid = el.dataset.paramId
        || (el.id && el.id.startsWith('param_') ? el.id.slice(6) : '')
        || (el.id && el.id.startsWith('knob_') ? el.id.slice(5) : '');
      if (pid && !el.dataset.paramId) el.dataset.paramId = pid;
      if (pid && sliderLookupFn) {
        attachKnobContextMenu(el, () => sliderLookupFn(pid));
      }
    });
    syncAllLockBadges();
  }

  // -----------------------------------------------------------------------
  // 6. Shared Header Preset Browser, A/B/C/D, 2D XY Morph Pad & Undo/Redo
  // -----------------------------------------------------------------------
  function mountHeaderKit(opts = {}) {
    const header = opts.header || document.querySelector('header');
    if (!header || header.dataset.wdHeaderMounted === '1') return null;
    header.dataset.wdHeaderMounted = '1';

    const host = opts.host || null;
    const enablePresets = opts.enablePresets !== false;

    // 6a) Tuck #themeSwitcher, #buildTag & #srTag into a unified Finish & Diagnostics Popover
    //     triggered by either .brand or a compact right-edge ◐ Finish button, freeing ~120px
    //     of horizontal header width so all 16 editors fit cleanly down to 640px.
    const brand = header.querySelector('.brand');
    const buildTag = document.getElementById('buildTag');
    const srTag = document.getElementById('srTag');
    const themeEl = header.querySelector('#themeSwitcher, .theme-strip, .theme-switcher');
    let finishBtn = null;

    if (brand || buildTag || srTag || themeEl) {
      const aboutPop = document.createElement('div');
      aboutPop.className = 'wd-popover wd-about-pop';
      aboutPop.hidden = true;
      const head = document.createElement('div');
      head.className = 'wd-pop-head';
      head.textContent = 'Finish & Diagnostics';
      aboutPop.appendChild(head);

      if (themeEl) {
        const prevSep = themeEl.previousElementSibling;
        if (prevSep && (prevSep.classList.contains('headsep') || prevSep.classList.contains('sep')))
          prevSep.style.display = 'none';
        finishBtn = document.createElement('button');
        finishBtn.className = 'wd-hbtn wd-finish-btn';
        finishBtn.textContent = '◐';
        finishBtn.title = 'Visual finish (Studio / Sumi / Washi) & diagnostics';
        finishBtn.setAttribute('aria-label', 'Visual finish and diagnostics');
        themeEl.replaceWith(finishBtn);

        const themeRow = document.createElement('div');
        themeRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;';
        const tLbl = document.createElement('span');
        tLbl.style.cssText = 'font:700 9.5px/1 var(--font);letter-spacing:0.08em;text-transform:uppercase;color:var(--label);';
        tLbl.textContent = 'Finish';
        themeRow.append(tLbl, themeEl);
        aboutPop.appendChild(themeRow);
      }

      if (srTag) {
        const statWrap = srTag.closest('.stat');
        if (statWrap && header.contains(statWrap)) {
          const prevSep = statWrap.previousElementSibling;
          if (prevSep && (prevSep.classList.contains('headsep') || prevSep.classList.contains('sep')))
            prevSep.style.display = 'none';
          statWrap.style.alignItems = 'flex-start';
          statWrap.style.marginBottom = '6px';
          aboutPop.appendChild(statWrap);
        }
      }
      if (buildTag && header.contains(buildTag)) {
        const prevSep = buildTag.previousElementSibling;
        if (prevSep && (prevSep.classList.contains('headsep') || prevSep.classList.contains('sep')))
          prevSep.style.display = 'none';
        buildTag.classList.remove('narrow-hide');
        buildTag.style.maxWidth = 'none';
        buildTag.style.textAlign = 'left';
        aboutPop.appendChild(buildTag);
      }
      document.body.appendChild(aboutPop);

      const toggleAbout = triggerEl => {
        const wasOpen = !aboutPop.hidden && activePopover && activePopover.el === aboutPop;
        closeMenus();
        if (!wasOpen) {
          const r = triggerEl.getBoundingClientRect();
          aboutPop.style.left = clamp(r.right > window.innerWidth * 0.6 ? r.right - 240 : r.left, 8, Math.max(8, window.innerWidth - 252)) + 'px';
          aboutPop.hidden = false;
          activePopover = { el: aboutPop, trigger: triggerEl };
        }
      };

      if (brand) {
        brand.title = 'Click for visual finish & build diagnostics';
        brand.addEventListener('click', ev => {
          if (ev.target.closest('input, button, select')) return;
          toggleAbout(brand);
        });
      }
      if (finishBtn) {
        finishBtn.addEventListener('click', () => toggleAbout(finishBtn));
      }
    }

    if (!enablePresets) return null;

    // State model (works both connected to C++ wd::PresetManager and in offline demo)
    let state = {
      presets: [{ name: 'Init', factory: true }],
      currentPreset: 'Init',
      activeSlot: 0,
      morphX: 0,
      morphY: 0,
      locks: [],
      canUndo: false,
      canRedo: false
    };

    const kit = document.createElement('div');
    kit.className = 'wd-header-kit';

    // Preset selector group: [ < | Preset Name v | > ]
    const presetGroup = document.createElement('div');
    presetGroup.className = 'wd-hgroup';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'wd-hbtn preset-step';
    prevBtn.textContent = '‹';
    prevBtn.title = 'Previous preset';
    const trigBtn = document.createElement('button');
    trigBtn.className = 'wd-hbtn preset-trigger';
    trigBtn.title = 'Open Preset Browser (Factory & User Presets)';
    const trigName = document.createElement('span');
    trigName.className = 'pname';
    trigName.textContent = 'Init';
    const trigCaret = document.createElement('span');
    trigCaret.textContent = '▾';
    trigCaret.style.opacity = '0.65';
    trigBtn.append(trigName, trigCaret);
    const nextBtn = document.createElement('button');
    nextBtn.className = 'wd-hbtn preset-step';
    nextBtn.textContent = '›';
    nextBtn.title = 'Next preset';
    presetGroup.append(prevBtn, trigBtn, nextBtn);

    // Snapshot A/B/C/D + 2D XY Morph group
    const slotGroup = document.createElement('div');
    slotGroup.className = 'wd-hgroup';
    const slotBtns = ['A', 'B', 'C', 'D'].map((lbl, idx) => {
      const b = document.createElement('button');
      b.className = 'wd-hbtn' + (idx === 0 ? ' on' : '');
      if (opts.useLegacyCompIds && idx === 0) b.id = 'btn_slotA';
      if (opts.useLegacyCompIds && idx === 1) b.id = 'btn_slotB';
      b.textContent = lbl;
      b.title = `Snapshot ${lbl} — click to compare`;
      b.addEventListener('click', () => selectSlot(idx));
      slotGroup.appendChild(b);
      return b;
    });

    const xyBtn = document.createElement('button');
    xyBtn.className = 'wd-hbtn';
    xyBtn.textContent = 'XY';
    xyBtn.title = 'Open 2D A/B/C/D Bilinear Parameter Morph Pad';
    slotGroup.appendChild(xyBtn);

    // Undo / Redo + Lock group
    const histGroup = document.createElement('div');
    histGroup.className = 'wd-hgroup';
    const undoBtn = document.createElement('button');
    undoBtn.className = 'wd-hbtn';
    undoBtn.textContent = '↶';
    undoBtn.title = 'Undo parameter change (Ctrl+Z)';
    undoBtn.disabled = true;
    const redoBtn = document.createElement('button');
    redoBtn.className = 'wd-hbtn';
    redoBtn.textContent = '↷';
    redoBtn.title = 'Redo parameter change (Ctrl+Y)';
    redoBtn.disabled = true;
    const lockBtn = document.createElement('button');
    lockBtn.className = 'wd-hbtn lock-pill';
    lockBtn.textContent = 'Lock 0';
    lockBtn.title = 'Right-click any knob to lock it across presets & XY morphs (click to clear locks)';
    lockBtn.hidden = true;
    histGroup.append(undoBtn, redoBtn, lockBtn);

    kit.append(presetGroup, slotGroup, histGroup);

    // Insert right before the compact Finish trigger (or at the right edge of header)
    if (finishBtn && finishBtn.parentElement === header) {
      header.insertBefore(kit, finishBtn);
    } else {
      header.appendChild(kit);
    }

    // Popover 1: Non-blocking Preset Browser + Save / Delete
    const presetPop = document.createElement('div');
    presetPop.className = 'wd-popover wd-preset-pop';
    presetPop.hidden = true;
    const pHead = document.createElement('div');
    pHead.className = 'wd-pop-head';
    const pHeadLbl = document.createElement('span');
    pHeadLbl.textContent = 'Presets';
    const delBtn = document.createElement('button');
    delBtn.className = 'wd-hbtn';
    delBtn.textContent = 'Delete';
    delBtn.hidden = true;
    pHead.append(pHeadLbl, delBtn);

    const pList = document.createElement('div');
    pList.className = 'wd-preset-list';

    const saveRow = document.createElement('div');
    saveRow.className = 'wd-preset-save-row';
    const saveInput = document.createElement('input');
    saveInput.type = 'text';
    saveInput.maxLength = 48;
    saveInput.placeholder = 'Save user preset as…';
    saveInput.className = 'preset-name-input';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'wd-hbtn on';
    saveBtn.textContent = 'Save';
    saveRow.append(saveInput, saveBtn);
    const statusMsg = document.createElement('div');
    statusMsg.style.cssText = 'font-size:10px;color:var(--amber,#f59e0b);margin-top:5px;min-height:12px;';
    presetPop.append(pHead, pList, saveRow, statusMsg);
    document.body.appendChild(presetPop);

    let confirmDeleteArmed = false;

    function applyState(next) {
      if (!next || typeof next !== 'object') return;
      if (Array.isArray(next.presets) && next.presets.length) state.presets = next.presets;
      if (typeof next.currentPreset === 'string' && next.currentPreset) state.currentPreset = next.currentPreset;
      if (typeof next.activeSlot === 'number') state.activeSlot = clamp(next.activeSlot, 0, 3);
      if (typeof next.morphX === 'number') state.morphX = clamp(next.morphX, 0, 1);
      if (typeof next.morphY === 'number') state.morphY = clamp(next.morphY, 0, 1);
      if (Array.isArray(next.locks)) {
        state.locks = next.locks;
        lockedParamSet.clear();
        next.locks.forEach(k => lockedParamSet.add(k));
        syncAllLockBadges();
      }
      if (typeof next.canUndo === 'boolean') state.canUndo = next.canUndo;
      if (typeof next.canRedo === 'boolean') state.canRedo = next.canRedo;

      trigName.textContent = state.currentPreset || 'Init';
      slotBtns.forEach((b, i) => b.classList.toggle('on', i === state.activeSlot));
      undoBtn.disabled = !state.canUndo;
      redoBtn.disabled = !state.canRedo;
      lockBtn.hidden = state.locks.length === 0;
      lockBtn.classList.toggle('active', state.locks.length > 0);
      lockBtn.textContent = 'Locked ' + state.locks.length;

      renderPresetList();
      drawMorphPad();
      if (opts.onStateChange) opts.onStateChange(state);
    }

    function renderPresetList() {
      pList.textContent = '';
      let currentIsUser = false;
      state.presets.forEach(item => {
        const nm = typeof item === 'string' ? item : item.name;
        const isFac = typeof item === 'object' ? !!item.factory : (nm === 'Init');
        const active = nm === state.currentPreset;
        if (active && !isFac) currentIsUser = true;

        const row = document.createElement('button');
        row.className = 'wd-preset-item' + (active ? ' on' : '');
        const lbl = document.createElement('span');
        lbl.textContent = nm;
        const tag = document.createElement('span');
        tag.className = 'ptag';
        tag.textContent = isFac ? 'FAC' : 'USR';
        row.append(lbl, tag);
        row.addEventListener('click', () => loadNamedPreset(nm));
        pList.appendChild(row);
      });
      delBtn.hidden = !currentIsUser;
      if (!confirmDeleteArmed) delBtn.textContent = 'Delete';
    }

    async function refreshState() {
      if (!host) return;
      try {
        const res = await host.call('wdGetPresetState');
        if (res && typeof res === 'object') applyState(res);
      } catch (_) {}
    }

    async function loadNamedPreset(name) {
      confirmDeleteArmed = false;
      statusMsg.textContent = '';
      if (host) {
        try {
          const res = await host.call('wdLoadPreset', name);
          if (res && res.state) applyState(res.state);
          else await refreshState();
        } catch (_) {}
      } else {
        applyState({ currentPreset: name });
      }
      if (opts.onPresetApplied) opts.onPresetApplied(name);
    }

    prevBtn.addEventListener('click', () => {
      if (!state.presets.length) return;
      const idx = state.presets.findIndex(p => (typeof p === 'string' ? p : p.name) === state.currentPreset);
      const nextIdx = idx <= 0 ? state.presets.length - 1 : idx - 1;
      const entry = state.presets[nextIdx];
      loadNamedPreset(typeof entry === 'string' ? entry : entry.name);
    });

    nextBtn.addEventListener('click', () => {
      if (!state.presets.length) return;
      const idx = state.presets.findIndex(p => (typeof p === 'string' ? p : p.name) === state.currentPreset);
      const nextIdx = (idx + 1) % state.presets.length;
      const entry = state.presets[nextIdx];
      loadNamedPreset(typeof entry === 'string' ? entry : entry.name);
    });

    trigBtn.addEventListener('click', async () => {
      const wasOpen = !presetPop.hidden;
      closeMenus();
      if (!wasOpen) {
        confirmDeleteArmed = false;
        statusMsg.textContent = '';
        await refreshState();
        const r = trigBtn.getBoundingClientRect();
        presetPop.style.left = clamp(r.left, 8, Math.max(8, window.innerWidth - 250)) + 'px';
        presetPop.hidden = false;
        activePopover = { el: presetPop, trigger: trigBtn };
      }
    });

    const commitSave = async () => {
      const nm = saveInput.value.trim();
      if (!nm) {
        statusMsg.textContent = 'Enter a preset name first.';
        return;
      }
      if (host) {
        try {
          const res = await host.call('wdSavePreset', nm);
          if (res && res.ok) {
            saveInput.value = '';
            statusMsg.textContent = '';
            if (res.state) applyState(res.state);
          } else {
            statusMsg.textContent = 'Invalid or reserved preset name.';
          }
        } catch (_) {}
      } else {
        state.presets.push({ name: nm, factory: false });
        saveInput.value = '';
        applyState({ currentPreset: nm });
      }
    };

    saveBtn.addEventListener('click', commitSave);
    saveInput.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); commitSave(); }
      ev.stopPropagation();
    });

    delBtn.addEventListener('click', async () => {
      if (!confirmDeleteArmed) {
        confirmDeleteArmed = true;
        delBtn.textContent = 'Confirm?';
        statusMsg.textContent = 'Click Confirm? to delete "' + state.currentPreset + '".';
        return;
      }
      confirmDeleteArmed = false;
      statusMsg.textContent = '';
      if (host) {
        try {
          const res = await host.call('wdDeletePreset', state.currentPreset);
          if (res && res.state) applyState(res.state);
        } catch (_) {}
      }
    });

    async function selectSlot(idx) {
      if (opts.onBeforeSlotSelect) {
        const handled = await opts.onBeforeSlotSelect(idx, state.activeSlot);
        if (handled) {
          applyState({ activeSlot: idx });
          return;
        }
      }
      if (host) {
        try {
          const res = await host.call('wdSelectSlot', idx);
          if (res && res.state) applyState(res.state);
        } catch (_) {}
      } else {
        applyState({ activeSlot: idx });
      }
    }

    // Popover 2: 2D Bilinear A/B/C/D XY Morph Pad
    const morphPop = document.createElement('div');
    morphPop.className = 'wd-popover wd-morph-pop';
    morphPop.hidden = true;
    const mHead = document.createElement('div');
    mHead.className = 'wd-pop-head';
    mHead.innerHTML = '<span>A/B/C/D Morph Pad</span><span id="wdMorphCoord">0%, 0%</span>';
    const morphCanvas = document.createElement('canvas');
    morphCanvas.className = 'wd-morph-canvas';
    morphCanvas.width = 352;
    morphCanvas.height = 352;
    const copyRow = document.createElement('div');
    copyRow.className = 'wd-morph-copy-row';
    ['A', 'B', 'C', 'D'].forEach((lbl, idx) => {
      const cb = document.createElement('button');
      cb.className = 'wd-hbtn';
      cb.textContent = '→ ' + lbl;
      cb.title = `Store current live parameters into corner ${lbl}`;
      cb.addEventListener('click', async () => {
        if (host) {
          try {
            const res = await host.call('wdCopySlot', idx);
            if (res && res.state) applyState(res.state);
          } catch (_) {}
        }
      });
      copyRow.appendChild(cb);
    });
    morphPop.append(mHead, morphCanvas, copyRow);
    document.body.appendChild(morphPop);

    const mCtx = morphCanvas.getContext('2d');
    function drawMorphPad() {
      if (!mCtx || morphPop.hidden) return;
      const w = 176, h = 176;
      mCtx.setTransform(2, 0, 0, 2, 0, 0);
      mCtx.clearRect(0, 0, w, h);

      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#38bdf8';
      mCtx.strokeStyle = 'rgba(255,255,255,0.08)';
      mCtx.lineWidth = 1;
      for (let g = 1; g <= 3; ++g) {
        const p = (g / 4) * w;
        mCtx.beginPath(); mCtx.moveTo(p, 0); mCtx.lineTo(p, h); mCtx.stroke();
        mCtx.beginPath(); mCtx.moveTo(0, p); mCtx.lineTo(w, p); mCtx.stroke();
      }

      const px = 14 + state.morphX * (w - 28);
      const py = 14 + state.morphY * (h - 28);

      // Corner tether lines weighted by bilinear proximity
      const corners = [
        { lbl: 'A', x: 14, y: 14, w: (1 - state.morphX) * (1 - state.morphY) },
        { lbl: 'B', x: w - 14, y: 14, w: state.morphX * (1 - state.morphY) },
        { lbl: 'C', x: 14, y: h - 14, w: (1 - state.morphX) * state.morphY },
        { lbl: 'D', x: w - 14, y: h - 14, w: state.morphX * state.morphY }
      ];

      corners.forEach(c => {
        mCtx.strokeStyle = `rgba(255,255,255,${(0.08 + 0.55 * c.w).toFixed(2)})`;
        mCtx.lineWidth = 1 + 1.5 * c.w;
        mCtx.beginPath(); mCtx.moveTo(c.x, c.y); mCtx.lineTo(px, py); mCtx.stroke();

        mCtx.fillStyle = c.w > 0.45 ? accent : 'rgba(255,255,255,0.55)';
        mCtx.font = '700 10px sans-serif';
        mCtx.textAlign = 'center';
        mCtx.textBaseline = 'middle';
        mCtx.fillText(c.lbl, c.x, c.y);
      });

      mCtx.fillStyle = accent;
      mCtx.beginPath(); mCtx.arc(px, py, 6.5, 0, Math.PI * 2); mCtx.fill();
      mCtx.strokeStyle = '#ffffff';
      mCtx.lineWidth = 1.6;
      mCtx.stroke();

      const coordEl = morphPop.querySelector('#wdMorphCoord');
      if (coordEl) coordEl.textContent = `${Math.round(state.morphX * 100)}%, ${Math.round(state.morphY * 100)}%`;
    }

    let morphDragging = false;
    const sendMorphAt = (ev, hold) => {
      const r = morphCanvas.getBoundingClientRect();
      const x = clamp((ev.clientX - r.left - 14) / Math.max(1, r.width - 28), 0, 1);
      const y = clamp((ev.clientY - r.top - 14) / Math.max(1, r.height - 28), 0, 1);
      state.morphX = x;
      state.morphY = y;
      drawMorphPad();
      if (host) {
        host.call('wdSetMorphXY', x, y, hold).catch(() => {});
      }
    };

    morphCanvas.addEventListener('pointerdown', ev => {
      if ((ev.button ?? 0) !== 0) return;
      morphDragging = true;
      try { morphCanvas.setPointerCapture(ev.pointerId); } catch (_) {}
      sendMorphAt(ev, true);
    });
    morphCanvas.addEventListener('pointermove', ev => {
      if (!morphDragging) return;
      sendMorphAt(ev, true);
    });
    const endMorphDrag = ev => {
      if (!morphDragging) return;
      morphDragging = false;
      try { morphCanvas.releasePointerCapture(ev.pointerId); } catch (_) {}
      if (host) {
        host.call('wdEndMorphXY').then(res => { if (res && res.state) applyState(res.state); }).catch(() => {});
      }
    };
    morphCanvas.addEventListener('pointerup', endMorphDrag);
    morphCanvas.addEventListener('pointercancel', endMorphDrag);

    xyBtn.addEventListener('click', async () => {
      const wasOpen = !morphPop.hidden;
      closeMenus();
      if (!wasOpen) {
        await refreshState();
        const r = xyBtn.getBoundingClientRect();
        morphPop.style.left = clamp(r.left - 90, 8, Math.max(8, window.innerWidth - 210)) + 'px';
        morphPop.hidden = false;
        activePopover = { el: morphPop, trigger: xyBtn };
        drawMorphPad();
      }
    });

    // Undo / Redo + Keyboard Shortcuts + Lock management
    const triggerUndo = async () => {
      if (!host) return;
      try {
        const res = await host.call('wdUndo');
        if (res && res.state) applyState(res.state);
      } catch (_) {}
    };
    const triggerRedo = async () => {
      if (!host) return;
      try {
        const res = await host.call('wdRedo');
        if (res && res.state) applyState(res.state);
      } catch (_) {}
    };

    undoBtn.addEventListener('click', triggerUndo);
    redoBtn.addEventListener('click', triggerRedo);

    lockBtn.addEventListener('click', async () => {
      if (!host) return;
      try {
        const res = await host.call('wdClearLocks');
        if (res && res.state) applyState(res.state);
      } catch (_) {}
    });

    lockToggleHandler = async (paramId, locked) => {
      if (locked) lockedParamSet.add(paramId);
      else lockedParamSet.delete(paramId);
      syncAllLockBadges();
      if (host) {
        try {
          const res = await host.call('wdSetParamLock', paramId, locked);
          if (res && res.state) applyState(res.state);
        } catch (_) {}
      }
    };

    // Attach on document (upstream of window in DOM bubble order) so plugin
    // Undo/Redo shortcuts call preventDefault() BEFORE WebKeyForwarding.h runs.
    document.addEventListener('keydown', ev => {
      const tag = ev.target && ev.target.tagName ? ev.target.tagName.toUpperCase() : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((ev.ctrlKey || ev.metaKey) && !ev.altKey) {
        const k = (ev.key || '').toLowerCase();
        if (k === 'z' && !ev.shiftKey && state.canUndo) {
          ev.preventDefault();
          triggerUndo();
        } else if ((k === 'y' || (k === 'z' && ev.shiftKey)) && state.canRedo) {
          ev.preventDefault();
          triggerRedo();
        }
      }
    });

    // Refresh Undo/Redo availability after parameter gestures finish
    window.addEventListener('pointerup', () => {
      if (host) setTimeout(refreshState, 90);
    });

    if (host) setTimeout(refreshState, 160);

    return {
      refresh: refreshState,
      setActiveSlotExternal(slotIdx) {
        state.activeSlot = clamp(slotIdx, 0, 3);
        slotBtns.forEach((b, i) => b.classList.toggle('on', i === state.activeSlot));
      }
    };
  }

  // -----------------------------------------------------------------------
  // 7. Global Settings Sync & Epoch-Driven Beacon Watcher
  // -----------------------------------------------------------------------
  function syncGlobalTheme(host, applyThemeFn) {
    if (!host || typeof applyThemeFn !== 'function') return;
    host.call('wdGetGlobalSettings').then(res => {
      if (res && typeof res.theme === 'string' && res.theme) {
        let local = '';
        try { local = localStorage.getItem('wd_theme') || ''; } catch (_) {}
        if (!local) applyThemeFn(res.theme);
      }
    }).catch(() => {});

    const sw = document.getElementById('themeSwitcher');
    if (sw) {
      sw.addEventListener('click', ev => {
        const btn = ev.target.closest('.theme-btn');
        if (btn && btn.dataset.theme && host) {
          host.call('wdSetGlobalSetting', 'theme', btn.dataset.theme).catch(() => {});
        }
      });
    }
  }

  function createBeaconEpochWatcher(refreshFn) {
    let lastEpoch = -1;
    return function checkMeters(meters) {
      if (!meters) return;
      if (typeof meters.bpm === 'number' && meters.bpm > 10)
        setHostBpm(meters.bpm);
      if (typeof meters.beaconEpoch !== 'number') return;
      if (meters.beaconEpoch !== lastEpoch) {
        lastEpoch = meters.beaconEpoch;
        refreshFn();
      }
    };
  }

  // -----------------------------------------------------------------------
  // 8. SVG Bezier Patch-Cord Drag & Inline Hover Depth/Polarity Ring
  // -----------------------------------------------------------------------
  function initPatchCords(cfg = {}) {
    const sourceSelector = cfg.sourceSelector || '[data-source-id]';
    const destSelector = cfg.destSelector || '.knob[data-dest-id]';
    const canvasTargets = Array.isArray(cfg.canvasTargets) ? cfg.canvasTargets.slice() : [];
    const getSourceColor = cfg.getSourceColor || (() => 'var(--cyan, #22d3ee)');
    const getSourceLabel = cfg.getSourceLabel || (id => 'Src ' + id);
    const getDestLabel = cfg.getDestLabel || (id => 'Dest ' + id);
    const getSlotsForDest = cfg.getSlotsForDest || (() => []);
    const onConnect = cfg.onConnect || (() => {});
    const onChangeDepth = cfg.onChangeDepth || (() => {});
    const onToggleSlot = cfg.onToggleSlot || (() => {});
    const onRemoveSlot = cfg.onRemoveSlot || (() => {});

    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'wd-patch-overlay');
    svg.style.display = 'none';
    const cordPath = document.createElementNS(SVGNS, 'path');
    cordPath.setAttribute('fill', 'none');
    cordPath.setAttribute('stroke-width', '2.5');
    cordPath.setAttribute('stroke-linecap', 'round');
    const cordTip = document.createElementNS(SVGNS, 'circle');
    cordTip.setAttribute('r', '4.5');
    const canvasBox = document.createElementNS(SVGNS, 'rect');
    canvasBox.setAttribute('fill', 'rgba(34, 211, 238, 0.08)');
    canvasBox.setAttribute('stroke-width', '1.8');
    canvasBox.setAttribute('rx', '5');
    canvasBox.style.display = 'none';
    svg.append(canvasBox, cordPath, cordTip);
    document.body.appendChild(svg);

    const pop = document.createElement('div');
    pop.className = 'wd-mod-ring-pop';
    pop.hidden = true;
    document.body.appendChild(pop);

    let activeDrag = null;
    let hoveredKnob = null;
    let activePopDestId = null;
    let activePopRect = null;
    let activePopKind = null;
    let hoverCloseTimer = null;
    let destroyed = false;

    const ac = createAbortController();
    const evOpts = ac ? { signal: ac.signal } : undefined;

    function cancelHoverClose() {
      if (hoverCloseTimer) {
        clearTimeout(hoverCloseTimer);
        hoverCloseTimer = null;
      }
    }

    function scheduleHoverClose() {
      cancelHoverClose();
      hoverCloseTimer = setTimeout(() => {
        if (activePopDestId !== null && !pop.matches(':hover')) {
          closePopover();
        }
      }, 160);
    }

    function closePopover() {
      cancelHoverClose();
      activePopDestId = null;
      activePopRect = null;
      activePopKind = null;
      pop.hidden = true;
      pop.textContent = '';
    }

    function renderPopover(destId, anchorRect, kind) {
      if (destroyed) return;
      const slots = getSlotsForDest(destId) || [];
      if (slots.length === 0) {
        closePopover();
        return;
      }
      activePopDestId = destId;
      activePopRect = anchorRect;
      if (kind !== undefined) activePopKind = kind;
      pop.textContent = '';

      const head = document.createElement('div');
      head.className = 'wd-mod-ring-head';
      const title = document.createElement('span');
      title.textContent = getDestLabel(destId);
      const count = document.createElement('span');
      count.className = 'wd-mod-ring-count';
      count.textContent = slots.length + (slots.length === 1 ? ' route' : ' routes');
      head.append(title, count);
      pop.appendChild(head);

      slots.forEach(slot => {
        const row = document.createElement('div');
        row.className = 'wd-mod-ring-row' + (slot.on ? '' : ' bypassed');

        const dot = document.createElement('span');
        dot.className = 'wd-mod-ring-dot';
        dot.style.background = getSourceColor(slot.source);

        const srcName = document.createElement('span');
        srcName.className = 'wd-mod-ring-src';
        srcName.textContent = getSourceLabel(slot.source);

        const rng = document.createElement('input');
        rng.type = 'range';
        rng.className = 'wd-mod-ring-depth';
        rng.min = '-2';
        rng.max = '2';
        rng.step = '0.01';
        rng.value = String(clamp(isFinite(slot.depth) ? slot.depth : 0, -2, 2));

        const valLbl = document.createElement('span');
        valLbl.className = 'wd-mod-ring-val';
        const fmtDepth = d => (d >= 0 ? '+' : '') + Number(d).toFixed(2);
        valLbl.textContent = fmtDepth(parseFloat(rng.value));

        let draggingDepth = false;
        rng.addEventListener('pointerdown', ev => {
          if ((ev.button ?? 0) !== 0) return;
          draggingDepth = true;
          onChangeDepth(slot.index, parseFloat(rng.value), false);
        });
        rng.addEventListener('input', () => {
          const d = parseFloat(rng.value);
          valLbl.textContent = fmtDepth(d);
          if (!draggingDepth) {
            draggingDepth = true;
            onChangeDepth(slot.index, d, false);
          } else {
            onChangeDepth(slot.index, d, false);
          }
        });
        const finishDepth = () => {
          const d = parseFloat(rng.value);
          valLbl.textContent = fmtDepth(d);
          if (draggingDepth) {
            draggingDepth = false;
            onChangeDepth(slot.index, d, true);
          }
        };
        rng.addEventListener('pointerup', finishDepth);
        rng.addEventListener('pointercancel', finishDepth);
        rng.addEventListener('change', () => {
          const d = parseFloat(rng.value);
          valLbl.textContent = fmtDepth(d);
          if (draggingDepth) {
            draggingDepth = false;
            onChangeDepth(slot.index, d, true);
          } else {
            onChangeDepth(slot.index, d, false);
            onChangeDepth(slot.index, d, true);
          }
        });

        const invBtn = document.createElement('button');
        invBtn.type = 'button';
        invBtn.className = 'wd-mod-ring-btn';
        invBtn.textContent = '±';
        invBtn.title = 'Invert polarity';
        invBtn.addEventListener('click', () => {
          const next = clamp(-(parseFloat(rng.value) || 0), -2, 2);
          rng.value = String(next);
          valLbl.textContent = fmtDepth(next);
          onChangeDepth(slot.index, next, false);
          onChangeDepth(slot.index, next, true);
        });

        const bypBtn = document.createElement('button');
        bypBtn.type = 'button';
        bypBtn.className = 'wd-mod-ring-btn' + (slot.on ? ' on' : '');
        bypBtn.textContent = slot.on ? 'On' : 'By';
        bypBtn.title = slot.on ? 'Bypass route' : 'Enable route';
        bypBtn.addEventListener('click', () => {
          onToggleSlot(slot.index, !slot.on);
          renderPopover(destId, anchorRect);
        });

        const rmBtn = document.createElement('button');
        rmBtn.type = 'button';
        rmBtn.className = 'wd-mod-ring-btn rm';
        rmBtn.textContent = '×';
        rmBtn.title = 'Remove route';
        rmBtn.addEventListener('click', () => {
          onRemoveSlot(slot.index);
          renderPopover(destId, anchorRect);
        });

        row.append(dot, srcName, rng, valLbl, invBtn, bypBtn, rmBtn);
        pop.appendChild(row);
      });

      pop.hidden = false;
      const popW = pop.offsetWidth || 236;
      const popH = pop.offsetHeight || 72;
      const r = anchorRect || { left: 20, top: 20, right: 80, bottom: 80 };
      const left = clamp(r.left + ((r.right - r.left) - popW) * 0.5, 8, Math.max(8, window.innerWidth - popW - 8));
      const top = (r.top - popH - 8 >= 8)
        ? (r.top - popH - 8)
        : clamp(r.bottom + 8, 8, Math.max(8, window.innerHeight - popH - 8));
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
    }

    function clearCordVisuals() {
      svg.style.display = 'none';
      canvasBox.style.display = 'none';
      if (hoveredKnob) {
        hoveredKnob.classList.remove('wd-cord-target');
        hoveredKnob = null;
      }
    }

    function hitTestDestination(cx, cy) {
      const destEls = document.querySelectorAll(destSelector);
      for (let i = 0; i < destEls.length; ++i) {
        const el = destEls[i];
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
          const did = parseInt(el.dataset.destId, 10);
          if (isFinite(did)) return { kind: 'knob', el, destId: did, rect: r };
        }
      }
      for (let i = 0; i < canvasTargets.length; ++i) {
        const t = canvasTargets[i];
        if (!t || !t.canvas) continue;
        const r = t.canvas.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
          if (typeof t.hitTest === 'function' && t.hitTest(cx, cy)) {
            const box = typeof t.getRect === 'function' ? t.getRect(cx, cy) : r;
            return { kind: 'canvas', target: t, destId: t.destId, rect: box || r };
          }
        }
      }
      return null;
    }

    function updateCordPath(sx, sy, dx, dy, color) {
      const dist = Math.hypot(dx - sx, dy - sy);
      const sag = Math.min(80, Math.max(24, dist * 0.35));
      const cy1 = sy + (dy >= sy ? sag * 0.4 : -sag * 0.4);
      const cy2 = dy - (dy >= sy ? sag * 0.4 : -sag * 0.4);
      cordPath.setAttribute('d', `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${sx.toFixed(1)} ${cy1.toFixed(1)}, ${dx.toFixed(1)} ${cy2.toFixed(1)}, ${dx.toFixed(1)} ${dy.toFixed(1)}`);
      cordPath.setAttribute('stroke', color);
      cordTip.setAttribute('cx', dx.toFixed(1));
      cordTip.setAttribute('cy', dy.toFixed(1));
      cordTip.setAttribute('fill', color);
    }

    function cancelDrag() {
      if (!activeDrag) return;
      activeDrag = null;
      clearCordVisuals();
    }

    document.addEventListener('pointerdown', ev => {
      if ((ev.button ?? 0) !== 0) return;
      const srcEl = ev.target && ev.target.closest ? ev.target.closest(sourceSelector) : null;
      if (!srcEl) return;
      const interactive = ev.target && ev.target.closest ? ev.target.closest('button, select, input, a') : null;
      if (interactive && interactive !== srcEl && srcEl.contains(interactive)) return;
      const sourceId = parseInt(srcEl.dataset.sourceId, 10);
      if (!isFinite(sourceId)) return;

      const r = srcEl.getBoundingClientRect();
      activeDrag = {
        sourceId,
        color: getSourceColor(sourceId),
        originX: r.width > 0 ? (r.left + r.width * 0.5) : ev.clientX,
        originY: r.height > 0 ? (r.top + r.height * 0.5) : ev.clientY,
        startX: ev.clientX,
        startY: ev.clientY,
        active: false,
        hit: null
      };
    }, evOpts);

    window.addEventListener('pointermove', ev => {
      if (!activeDrag) return;
      if (!activeDrag.active) {
        if (Math.hypot(ev.clientX - activeDrag.startX, ev.clientY - activeDrag.startY) <= 5)
          return;
        activeDrag.active = true;
        closePopover();
        svg.style.display = 'block';
      }

      updateCordPath(activeDrag.originX, activeDrag.originY, ev.clientX, ev.clientY, activeDrag.color);
      const hit = hitTestDestination(ev.clientX, ev.clientY);
      activeDrag.hit = hit;

      if (hoveredKnob && (!hit || hit.el !== hoveredKnob)) {
        hoveredKnob.classList.remove('wd-cord-target');
        hoveredKnob = null;
      }
      if (hit && hit.kind === 'knob') {
        hoveredKnob = hit.el;
        hoveredKnob.classList.add('wd-cord-target');
        canvasBox.style.display = 'none';
      } else if (hit && hit.kind === 'canvas' && hit.rect) {
        canvasBox.setAttribute('x', String(hit.rect.left));
        canvasBox.setAttribute('y', String(hit.rect.top));
        canvasBox.setAttribute('width', String(Math.max(8, hit.rect.width)));
        canvasBox.setAttribute('height', String(Math.max(8, hit.rect.height)));
        canvasBox.setAttribute('stroke', activeDrag.color);
        canvasBox.style.display = '';
      } else {
        canvasBox.style.display = 'none';
      }
    }, evOpts);

    window.addEventListener('pointerup', ev => {
      if (!activeDrag) return;
      const wasActive = activeDrag.active;
      const hit = wasActive ? (hitTestDestination(ev.clientX, ev.clientY) || activeDrag.hit) : null;
      const sourceId = activeDrag.sourceId;
      cancelDrag();
      if (wasActive && hit && isFinite(hit.destId)) {
        onConnect(sourceId, hit.destId);
        renderPopover(hit.destId, hit.rect, hit.kind);
      }
    }, evOpts);

    window.addEventListener('pointercancel', cancelDrag, evOpts);
    window.addEventListener('blur', cancelDrag, evOpts);
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') {
        cancelDrag();
        closePopover();
      }
    }, evOpts);

    // Inline hover popover triggers for modulated knobs & canvas handles
    document.addEventListener('pointerover', ev => {
      if (activeDrag && activeDrag.active) return;
      if (pop.contains(ev.target)) {
        cancelHoverClose();
        return;
      }
      const knob = ev.target && ev.target.closest ? ev.target.closest(destSelector) : null;
      if (knob && !knob.classList.contains('dragging')) {
        const destId = parseInt(knob.dataset.destId, 10);
        if (isFinite(destId) && (getSlotsForDest(destId) || []).length > 0) {
          cancelHoverClose();
          renderPopover(destId, knob.getBoundingClientRect(), 'knob');
        }
      }
    }, evOpts);

    document.addEventListener('pointerout', ev => {
      const knob = ev.target && ev.target.closest ? ev.target.closest(destSelector) : null;
      if (knob && (!ev.relatedTarget || (!knob.contains(ev.relatedTarget) && !pop.contains(ev.relatedTarget)))) {
        scheduleHoverClose();
        return;
      }
      if (activePopKind === 'canvas' && activePopDestId !== null) {
        const isCanvas = canvasTargets.some(t => t && t.canvas && (ev.target === t.canvas || t.canvas.contains(ev.target)));
        if (isCanvas && (!ev.relatedTarget || (!pop.contains(ev.relatedTarget) && !(ev.relatedTarget.closest && ev.relatedTarget.closest(destSelector))))) {
          if (!hoverCloseTimer) scheduleHoverClose();
        }
      }
    }, evOpts);

    document.addEventListener('pointerleave', () => {
      if (activePopDestId !== null && !hoverCloseTimer) {
        scheduleHoverClose();
      }
    }, evOpts);

    document.addEventListener('pointermove', ev => {
      if (activeDrag && activeDrag.active) return;
      if (pop.contains(ev.target)) {
        cancelHoverClose();
        return;
      }
      for (let i = 0; i < canvasTargets.length; ++i) {
        const t = canvasTargets[i];
        if (!t || !t.canvas) continue;
        if (ev.target === t.canvas && typeof t.hitTest === 'function' && t.hitTest(ev.clientX, ev.clientY)) {
          if ((getSlotsForDest(t.destId) || []).length > 0) {
            cancelHoverClose();
            const r = typeof t.getRect === 'function' ? t.getRect(ev.clientX, ev.clientY) : t.canvas.getBoundingClientRect();
            renderPopover(t.destId, r, 'canvas');
            return;
          }
        }
      }
      if (activePopKind === 'canvas' && activePopDestId !== null
          && !(ev.target && ev.target.closest && ev.target.closest(destSelector))) {
        if (!hoverCloseTimer) scheduleHoverClose();
      }
    }, evOpts);

    pop.addEventListener('pointerenter', cancelHoverClose, evOpts);
    pop.addEventListener('pointerleave', scheduleHoverClose, evOpts);

    return {
      registerCanvasTarget(t) {
        if (t && !canvasTargets.includes(t)) canvasTargets.push(t);
      },
      refresh() {
        if (activePopDestId !== null && !pop.hidden)
          renderPopover(activePopDestId, activePopRect, activePopKind);
      },
      openForDest(destId, rect) {
        renderPopover(destId, rect, 'manual');
      },
      close: closePopover,
      destroy() {
        destroyed = true;
        cancelDrag();
        closePopover();
        if (ac) ac.abort();
        if (svg.parentNode) svg.parentNode.removeChild(svg);
        if (pop.parentNode) pop.parentNode.removeChild(pop);
      }
    };
  }

  // -----------------------------------------------------------------------
  // 9. XLFO Shape Presets & Step Transforms
  // -----------------------------------------------------------------------
  const XLFO_PRESETS = Object.freeze([
    'Sine', 'Triangle', 'Saw', 'Ramp', 'Square', 'S&H', 'Sidechain Pump', 'Euclidean'
  ]);

  function bjorklundPattern(pulses, steps) {
    const k = clamp(Math.round(pulses), 0, steps);
    if (k === 0) return new Array(steps).fill(0);
    if (k === steps) return new Array(steps).fill(1);
    const out = new Array(steps).fill(0);
    let bucket = 0;
    for (let i = 0; i < steps; ++i) {
      bucket += k;
      if (bucket >= steps) {
        bucket -= steps;
        out[i] = 1;
      }
    }
    return out;
  }

  function buildXlfoPresetSteps(name, numSteps = 16, opts = {}) {
    const rawNum = (numSteps === null || numSteps === undefined) ? 16 : Number(numSteps);
    const n = Number.isFinite(rawNum) ? clamp(Math.round(rawNum), 1, 32) : 16;
    const key = String(name || 'Sine').trim().toLowerCase();
    const steps = new Array(32);

    let euc = null;
    if (key === 'euclidean') {
      const pulses = opts.pulses !== undefined
        ? opts.pulses
        : Math.max(1, Math.round(n * 0.375));
      euc = bjorklundPattern(pulses, n);
    }

    let seed = (opts.seed !== undefined ? opts.seed : 0x51a7c3) >>> 0;
    const nextRand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < 32; ++i) {
      let value = 0.0;
      let glide = 100.0;
      let slope = 0.0;

      if (i < n) {
        if (key === 'sine') {
          value = 0.5 - 0.5 * Math.cos(2 * Math.PI * ((i + 1) / n));
          glide = 100.0;
        } else if (key === 'triangle') {
          const p = (i + 1) / n;
          value = 1.0 - Math.abs(2.0 * p - 1.0);
          glide = 100.0;
        } else if (key === 'ramp') {
          value = n === 1 ? 1.0 : (i / (n - 1));
          glide = i === 0 ? 0.0 : 100.0;
        } else if (key === 'saw') {
          value = n === 1 ? 1.0 : (1.0 - i / (n - 1));
          glide = i === 0 ? 0.0 : 100.0;
        } else if (key === 'square') {
          value = i < Math.ceil(n / 2) ? 1.0 : 0.0;
          glide = 0.0;
        } else if (key === 's&h' || key === 'sh' || key === 'random') {
          value = 0.06 + nextRand() * 0.9;
          glide = 0.0;
        } else if (key === 'sidechain pump' || key === 'pump') {
          if (i === 0) {
            value = 0.0;
            glide = 0.0;
            slope = 0.0;
          } else {
            const u = i / Math.max(1, n - 1);
            value = clamp(Math.pow(u, 0.58), 0, 1);
            glide = 100.0;
            slope = 0.45;
          }
        } else if (key === 'euclidean') {
          const hit = euc[i] === 1;
          value = hit ? 1.0 : 0.0;
          glide = hit ? 0.0 : 85.0;
          slope = hit ? 0.0 : -0.35;
        } else {
          value = 0.5 - 0.5 * Math.cos(2 * Math.PI * ((i + 1) / n));
          glide = 100.0;
        }
      }

      steps[i] = {
        index: i,
        value: clamp(value, 0, 1),
        glide: clamp(glide, 0, 100),
        slope: clamp(slope, -1, 1)
      };
    }
    Object.defineProperty(steps, 'numSteps', {
      value: n,
      enumerable: false,
      writable: true,
      configurable: true
    });
    return { numSteps: n, steps };
  }

  function transformXlfoSteps(steps, op, arg, numStepsArg) {
    const src = Array.isArray(steps) ? steps : [];
    const argObj = (arg && typeof arg === 'object') ? arg : {};
    const maxLen = (src.length > 0 && src.length <= 32) ? src.length : 32;
    const resolvedNum = (numStepsArg !== undefined && numStepsArg !== null)
      ? numStepsArg
      : ((argObj && argObj.numSteps != null)
        ? argObj.numSteps
        : (typeof src.numSteps === 'number' && Number.isFinite(src.numSteps)
          ? src.numSteps
          : (src.length > 0 ? src.length : 16)));
    const rawActive = Number(resolvedNum);
    const activeLen = clamp(
      Number.isFinite(rawActive) ? Math.round(rawActive) : 16,
      1, maxLen
    );

    const out = new Array(32);
    for (let i = 0; i < 32; ++i) {
      const s = src[i] || {};
      out[i] = {
        index: i,
        value: clamp(isFinite(s.value) ? s.value : 0, 0, 1),
        glide: clamp(isFinite(s.glide) ? s.glide : 100, 0, 100),
        slope: clamp(isFinite(s.slope) ? s.slope : 0, -1, 1)
      };
    }

    const kind = String(op || '').trim().toLowerCase();
    if (kind === 'invert') {
      for (let i = 0; i < activeLen; ++i) {
        out[i].value = clamp(1.0 - out[i].value, 0, 1);
        out[i].slope = clamp(-out[i].slope, -1, 1);
      }
    } else if (kind === 'shift') {
      const delta = typeof arg === 'number' ? Math.round(arg) : Math.round(argObj.shift ?? 1);
      const snapshot = out.slice(0, activeLen).map(x => ({ ...x }));
      for (let i = 0; i < activeLen; ++i) {
        const srcIdx = ((i - delta) % activeLen + activeLen) % activeLen;
        out[i].value = snapshot[srcIdx].value;
        out[i].glide = snapshot[srcIdx].glide;
        out[i].slope = snapshot[srcIdx].slope;
      }
    } else if (kind === 'smooth') {
      const amt = clamp(typeof arg === 'number' ? arg : (argObj.amount ?? 35), 0, 100);
      const blend = amt / 100.0;
      const vals = out.slice(0, activeLen).map(x => x.value);
      for (let i = 0; i < activeLen; ++i) {
        const prev = vals[(i - 1 + activeLen) % activeLen];
        const curr = vals[i];
        const next = vals[(i + 1) % activeLen];
        const avg = 0.25 * prev + 0.5 * curr + 0.25 * next;
        out[i].value = clamp(curr + blend * (avg - curr), 0, 1);
        out[i].glide = clamp(out[i].glide + amt, 0, 100);
      }
    }
    Object.defineProperty(out, 'numSteps', {
      value: activeLen,
      enumerable: false,
      writable: true,
      configurable: true
    });
    return out;
  }

  // -----------------------------------------------------------------------
  // 10. 10-Second Retroactive History Ring Buffer & Scrub Timeline
  // -----------------------------------------------------------------------
  function createHistoryBuffer(opts = {}) {
    const cap = Math.max(1, Math.round(opts.capacity || 600));
    const cloneFrame = typeof opts.cloneFrame === 'function' ? opts.cloneFrame : null;
    const slots = new Array(cap);
    let head = 0;
    let count = 0;
    let frozen = false;
    let scrubOffset = 0;

    function getFrameAt(chronIdx) {
      if (count === 0) return null;
      const idx = clamp(Math.round(chronIdx), 0, count - 1);
      const oldest = (head - count + cap) % cap;
      return slots[(oldest + idx) % cap];
    }

    return {
      push(frame) {
        if (frozen) return false;
        slots[head] = cloneFrame ? cloneFrame(frame, slots[head]) : frame;
        head = (head + 1) % cap;
        if (count < cap) count++;
        scrubOffset = 0;
        return true;
      },
      setFrozen(next) {
        frozen = !!next;
        if (!frozen) scrubOffset = 0;
        else scrubOffset = clamp(scrubOffset, 0, Math.max(0, count - 1));
      },
      isFrozen() { return frozen; },
      length() { return count; },
      capacity() { return cap; },
      setScrubIndex(chronIdx) {
        if (count === 0) { scrubOffset = 0; return 0; }
        const clamped = clamp(Math.round(chronIdx), 0, count - 1);
        scrubOffset = (count - 1) - clamped;
        return clamped;
      },
      setScrubNormalized(t) {
        if (count <= 1) { scrubOffset = 0; return 0; }
        const idx = Math.round(clamp(t, 0, 1) * (count - 1));
        scrubOffset = (count - 1) - idx;
        return idx;
      },
      getScrubIndex() {
        if (count === 0) return 0;
        return clamp((count - 1) - scrubOffset, 0, count - 1);
      },
      getScrubNormalized() {
        if (count <= 1) return 1;
        return this.getScrubIndex() / (count - 1);
      },
      getAgeSeconds(hz = 60) {
        if (count === 0) return 0;
        return clamp(scrubOffset, 0, Math.max(0, count - 1)) / Math.max(1, hz);
      },
      getFrameAt,
      getActiveFrame() {
        if (count === 0) return null;
        return getFrameAt(this.getScrubIndex());
      },
      forEachChronological(cb) {
        if (typeof cb !== 'function' || count === 0) return;
        const oldest = (head - count + cap) % cap;
        for (let i = 0; i < count; ++i) {
          cb(slots[(oldest + i) % cap], i, count);
        }
      },
      clear() {
        head = 0;
        count = 0;
        scrubOffset = 0;
      }
    };
  }

  function mountScrubTimeline(cfg = {}) {
    const container = cfg.container;
    const historyBuffer = cfg.historyBuffer;
    const hz = Math.max(1, cfg.hz || 60);
    const onToggleHold = typeof cfg.onToggleHold === 'function' ? cfg.onToggleHold : null;
    const onScrub = typeof cfg.onScrub === 'function' ? cfg.onScrub : null;
    if (!container || !historyBuffer) return { update() {}, destroy() {} };

    const bar = document.createElement('div');
    bar.className = 'wd-scrub-bar';

    const holdBtn = document.createElement('button');
    holdBtn.type = 'button';
    holdBtn.className = 'wd-scrub-hold';
    holdBtn.textContent = 'Hold';
    holdBtn.title = 'Freeze 10-second retroactive buffer and scrub history';

    const track = document.createElement('div');
    track.className = 'wd-scrub-track';
    track.setAttribute('role', 'slider');
    track.setAttribute('aria-label', cfg.label || '10-second history scrub');

    const fill = document.createElement('div');
    fill.className = 'wd-scrub-fill';
    const thumb = document.createElement('div');
    thumb.className = 'wd-scrub-thumb';
    track.append(fill, thumb);

    const ageLbl = document.createElement('span');
    ageLbl.className = 'wd-scrub-age';
    ageLbl.textContent = 'LIVE';

    bar.append(holdBtn, track, ageLbl);
    container.appendChild(bar);

    function update() {
      const frozen = historyBuffer.isFrozen();
      const norm = frozen ? historyBuffer.getScrubNormalized() : 1.0;
      const pct = (norm * 100).toFixed(2) + '%';
      fill.style.width = pct;
      thumb.style.left = pct;
      bar.classList.toggle('frozen', frozen);
      holdBtn.classList.toggle('on', frozen);
      if (!frozen) {
        ageLbl.textContent = 'LIVE';
      } else {
        const age = historyBuffer.getAgeSeconds(hz);
        ageLbl.textContent = age <= 0.02 ? 'HOLD 0.0s' : ('-' + age.toFixed(1) + 's');
      }
    }

    const ac = createAbortController();
    const evOpts = ac ? { signal: ac.signal } : undefined;

    holdBtn.addEventListener('click', () => {
      const next = !historyBuffer.isFrozen();
      historyBuffer.setFrozen(next);
      update();
      if (onToggleHold) onToggleHold(next, historyBuffer.getActiveFrame());
      if (onScrub) onScrub(historyBuffer.getActiveFrame(), historyBuffer.getAgeSeconds(hz), next);
    }, evOpts);

    let scrubbing = false;
    function seekAt(clientX) {
      const r = track.getBoundingClientRect();
      const t = r.width > 0 ? clamp((clientX - r.left) / r.width, 0, 1) : 1;
      if (!historyBuffer.isFrozen()) {
        historyBuffer.setFrozen(true);
        if (onToggleHold) onToggleHold(true, historyBuffer.getActiveFrame());
      }
      historyBuffer.setScrubNormalized(t);
      update();
      if (onScrub) onScrub(historyBuffer.getActiveFrame(), historyBuffer.getAgeSeconds(hz), true);
    }

    track.addEventListener('pointerdown', ev => {
      if ((ev.button ?? 0) !== 0) return;
      scrubbing = true;
      try { track.setPointerCapture(ev.pointerId); } catch (_) {}
      seekAt(ev.clientX);
      ev.preventDefault();
    }, evOpts);

    track.addEventListener('pointermove', ev => {
      if (!scrubbing) return;
      seekAt(ev.clientX);
    }, evOpts);

    const endScrub = ev => {
      if (!scrubbing) return;
      scrubbing = false;
      try { track.releasePointerCapture(ev.pointerId); } catch (_) {}
    };
    track.addEventListener('pointerup', endScrub, evOpts);
    track.addEventListener('pointercancel', endScrub, evOpts);

    track.addEventListener('dblclick', () => {
      historyBuffer.setFrozen(false);
      update();
      if (onToggleHold) onToggleHold(false, historyBuffer.getActiveFrame());
      if (onScrub) onScrub(historyBuffer.getActiveFrame(), 0, false);
    }, evOpts);

    update();
    return {
      update,
      destroy() {
        if (ac) ac.abort();
        if (bar.parentNode) bar.parentNode.removeChild(bar);
      }
    };
  }

  window.WDKit = {
    parseMusicalValue,
    setHostBpm,
    getHostBpm,
    normalizeWheelDelta,
    attachWheelGesture,
    expBallistic,
    createRenderLoop,
    createTelemetryPoller,
    mountKnob,
    paintKnob,
    bindSliderKnob,
    upgradeKnobVisuals,
    setKnobModulation,
    setKnobModulationSources,
    scaledDeltaToNorm,
    attachKnobContextMenu,
    enhanceAllKnobs,
    mountHeaderKit,
    syncGlobalTheme,
    createBeaconEpochWatcher,
    initPatchCords,
    XLFO_PRESETS,
    buildXlfoPresetSteps,
    transformXlfoSteps,
    createHistoryBuffer,
    mountScrubTimeline
  };
})();
