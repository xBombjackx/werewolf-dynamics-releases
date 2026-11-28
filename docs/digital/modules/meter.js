// modules/meter.js — Web demo module spec for Werewolf Digital Meter.
// Matches Source/meter/MeterProcessor.cpp, MeterEditor.cpp, & ui/index.html.
(() => {
  'use strict';

  const SPEC_BINS = 240;
  const K_WAVE = 200;
  const K_CYCLE = 256;
  const K_GONIO = 256;
  const K_HIST = 120;
  const FFT_N = 4096;

  const FIXED_END = 19 + 4 * SPEC_BINS + 4 * K_WAVE + 3 * K_CYCLE; // 2547
  const TOTAL_FLOATS = FIXED_END + 2 * K_GONIO + 2 * K_HIST + 25;   // 3324

  const telem = new Float32Array(TOTAL_FLOATS);
  const fftStereo = new Float32Array(SPEC_BINS).fill(-120);
  const fftMid = new Float32Array(SPEC_BINS).fill(-120);
  const fftSide = new Float32Array(SPEC_BINS).fill(-120);
  const fftSc = new Float32Array(SPEC_BINS).fill(-120);

  const waveMin = new Float32Array(K_WAVE);
  const waveMax = new Float32Array(K_WAVE);
  const waveRms = new Float32Array(K_WAVE);
  const waveSc = new Float32Array(K_WAVE);
  let waveWriteCol = 0;

  const cycleMid = new Float32Array(K_CYCLE);
  const cycleSide = new Float32Array(K_CYCLE);
  const cycleSc = new Float32Array(K_CYCLE);

  const gonioMid = new Float32Array(K_GONIO);
  const gonioSide = new Float32Array(K_GONIO);
  let gonioWrite = 0;

  const histMom = new Float32Array(K_HIST).fill(-70);
  const histSt = new Float32Array(K_HIST).fill(-70);
  let histWrite = 0;
  let lastHistPushMs = 0;
  let lastFrameMs = 0;

  // Pre-allocated stereo time-domain & radix-2 FFT scratch buffers (zero per-frame GC)
  const timeL = new Float32Array(FFT_N);
  const timeR = new Float32Array(FFT_N);
  const hann = new Float32Array(FFT_N);
  let hannSum = 0;
  for (let i = 0; i < FFT_N; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / FFT_N));
    hann[i] = w;
    hannSum += w;
  }
  const bitrev = new Uint16Array(FFT_N);
  for (let i = 0, j = 0; i < FFT_N; i++) {
    bitrev[i] = j;
    let bit = FFT_N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
  }
  const twRe = new Float32Array(FFT_N / 2);
  const twIm = new Float32Array(FFT_N / 2);
  for (let i = 0; i < FFT_N / 2; i++) {
    twRe[i] = Math.cos((-2 * Math.PI * i) / FFT_N);
    twIm[i] = Math.sin((-2 * Math.PI * i) / FFT_N);
  }
  const fftRe = new Float32Array(FFT_N);
  const fftIm = new Float32Array(FFT_N);
  const mags = new Float32Array(FFT_N / 2 + 1);

  const refTonalBands = new Array(10).fill(-140);
  const snapMeta = {
    hasRef: false,
    refDeltaLufs: 0,
    refDeltaTp: 0,
    refDeltaCrest: 0,
    refTonalBands,
  };

  let telemSeq = 1;
  let lastMetaHasRef = false;
  let metaDirty = true;

  const uiState = {
    preset: 'Bus',
    target: 'Spotify',
    tonalTarget: 'Pop',
    slope: 4.5,
    specView: 'spectrum',
    specChan: 'stereo',
    scopeMode: 'rolling',
    kSystem: 'off',
    spectrumOn: true,
    scopeOn: true,
    loudnessOn: true,
    stereoOn: true,
    dynamicsOn: true,
    historyOn: true,
  };

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function tonalIndexOf(name) {
    if (name === 'Pop') return 0;
    if (name === 'Rock') return 1;
    if (name === 'Hip-Hop') return 2;
    return 3;
  }

  function computeMsSpectrum(mode, sr, outBins) {
    let rms = 0;
    for (let i = 0; i < FFT_N; i++) {
      const s = mode === 0 ? 0.5 * (timeL[i] + timeR[i]) : 0.5 * (timeL[i] - timeR[i]);
      rms += s * s;
      const rev = bitrev[i];
      fftRe[rev] = s * hann[i];
      fftIm[rev] = 0;
    }
    if (rms < 1e-12) {
      outBins.fill(-120);
      return;
    }
    for (let size = 2; size <= FFT_N; size <<= 1) {
      const half = size >> 1;
      const step = FFT_N / size;
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
    const norm = hannSum > 1e-6 ? 2.0 / hannSum : 1.0;
    const maxBin = FFT_N >> 1;
    for (let k = 0; k <= maxBin; k++) {
      mags[k] = Math.hypot(fftRe[k], fftIm[k]) * norm;
    }
    const fMin = 10.0;
    const fMax = 24000.0;
    const nyquist = 0.5 * sr;
    const logRatio = Math.log(fMax / fMin);
    const binScale = FFT_N / sr;
    for (let b = 0; b < SPEC_BINS; b++) {
      const f0 = fMin * Math.exp((logRatio * b) / SPEC_BINS);
      const f1 = fMin * Math.exp((logRatio * (b + 1)) / SPEC_BINS);
      const fc = Math.sqrt(f0 * f1);
      if (fc > nyquist) {
        outBins[b] = -120;
        continue;
      }
      const i0 = Math.max(0, Math.min(maxBin, Math.floor(f0 * binScale)));
      const i1 = Math.max(i0, Math.min(maxBin, Math.ceil(f1 * binScale)));
      let peakMag = 0;
      for (let k = i0; k <= i1; k++) {
        if (mags[k] > peakMag) peakMag = mags[k];
      }
      const db = 20.0 * Math.log10(Math.max(1e-6, peakMag));
      const prev = outBins[b];
      outBins[b] = prev < -119.0 ? db : 0.68 * prev + 0.32 * db;
    }
  }

  function updateWaveAndGonio(sr, dtSec) {
    const newSamples = Math.min(FFT_N, Math.max(128, Math.round(sr * dtSec)));
    const start = FFT_N - newSamples;

    // 1) Rolling waveform columns (~150 cols/s hop)
    const hop = Math.max(64, Math.round(sr / 150));
    for (let pos = start; pos < FFT_N; pos += hop) {
      const end = Math.min(FFT_N, pos + hop);
      const count = end - pos;
      if (count <= 0) break;
      let wMin = 0;
      let wMax = 0;
      let wSq = 0;
      for (let i = pos; i < end; i++) {
        const l = timeL[i];
        const r = timeR[i];
        const mono = 0.5 * (l + r);
        if (mono < wMin) wMin = mono;
        if (mono > wMax) wMax = mono;
        wSq += 0.5 * (l * l + r * r);
      }
      waveMin[waveWriteCol] = clamp(wMin, -1.5, 1.5);
      waveMax[waveWriteCol] = clamp(wMax, -1.5, 1.5);
      waveRms[waveWriteCol] = clamp(Math.sqrt(wSq / count), 0, 1.5);
      waveWriteCol = (waveWriteCol + 1) % K_WAVE;
    }

    // 2) Peak-tracking decimated M/S goniometer points
    const dec = Math.max(1, Math.round((16.0 * sr) / 48000.0));
    for (let pos = start; pos < FFT_N; pos += dec) {
      const end = Math.min(FFT_N, pos + dec);
      let maxE = -1;
      let pkM = 0;
      let pkS = 0;
      for (let i = pos; i < end; i++) {
        const m = 0.5 * (timeL[i] + timeR[i]);
        const s = 0.5 * (timeL[i] - timeR[i]);
        const e = m * m + s * s;
        if (e > maxE) {
          maxE = e;
          pkM = m;
          pkS = s;
        }
      }
      gonioMid[gonioWrite] = pkM;
      gonioSide[gonioWrite] = pkS;
      gonioWrite = (gonioWrite + 1) % K_GONIO;
    }
  }

  function updateCycleScope(sr, pitchVoiced, pitchHz) {
    const hasPitch = pitchVoiced && pitchHz >= 25.0 && pitchHz <= 1200.0;
    const spanSamples = hasPitch
      ? clamp((2.0 * sr) / pitchHz, 32.0, 3600.0)
      : clamp(0.010 * sr, 128.0, 2048.0);

    const minOffset = Math.ceil(spanSamples) + 2;
    const maxSearchBack = Math.min(FFT_N - 2, minOffset + 1600);
    let triggerBack = minOffset;
    let bestSlope = 0.0;
    let foundTrigger = false;

    for (let back = minOffset; back < maxSearchBack - 1; back++) {
      const i0 = FFT_N - 1 - (back + 1);
      const i1 = FFT_N - 1 - back;
      const s0 = 0.5 * (timeL[i0] + timeR[i0]);
      const s1 = 0.5 * (timeL[i1] + timeR[i1]);
      if (s0 <= 0.0 && s1 > 0.0) {
        const slope = s1 - s0;
        if (!foundTrigger || slope > bestSlope * 1.15) {
          const frac = -s0 / Math.max(1e-9, slope);
          triggerBack = (back + 1) - frac;
          bestSlope = slope;
          foundTrigger = true;
          if (hasPitch && bestSlope > 1e-4) break;
        }
      }
    }

    for (let p = 0; p < K_CYCLE; p++) {
      const bOff = triggerBack - (p / (K_CYCLE - 1)) * spanSamples;
      const pos = clamp(FFT_N - 1 - bOff, 0, FFT_N - 2);
      const i0 = Math.floor(pos);
      const frac = pos - i0;
      const l = timeL[i0] * (1 - frac) + timeL[i0 + 1] * frac;
      const r = timeR[i0] * (1 - frac) + timeR[i0 + 1] * frac;
      cycleMid[p] = clamp(0.5 * (l + r), -1.5, 1.5);
      cycleSide[p] = clamp(0.5 * (l - r), -1.5, 1.5);
    }
  }

  function clearJsAnalysis() {
    fftStereo.fill(-120);
    fftMid.fill(-120);
    fftSide.fill(-120);
    waveMin.fill(0);
    waveMax.fill(0);
    waveRms.fill(0);
    waveWriteCol = 0;
    cycleMid.fill(0);
    cycleSide.fill(0);
    gonioMid.fill(0);
    gonioSide.fill(0);
    gonioWrite = 0;
    histMom.fill(-70);
    histSt.fill(-70);
    histWrite = 0;
  }

  window.__WD_PLUGIN_SPEC__ = {
    slug: 'meter',
    title: 'Werewolf Digital Meter',
    defaultStem: 'Keys',
    needsStereoAnalysers: true,
    presets: [],
    params: [],
    extraUiState: () => ({ ...uiState }),
    nativeFunctions: {
      async setUiState(hostCtx, key, val) {
        if (key === 'preset' || key === 'target' || key === 'tonalTarget'
            || key === 'specView' || key === 'specChan' || key === 'scopeMode' || key === 'kSystem') {
          if (typeof val === 'string') {
            uiState[key] = val.slice(0, 64);
            if (key === 'tonalTarget') hostCtx.sendAction(4, tonalIndexOf(uiState[key]));
          }
        } else if (key === 'slope') {
          const n = Number(val);
          if (Number.isFinite(n)) uiState.slope = clamp(n, -12, 12);
        } else if (key === 'spectrumOn' || key === 'scopeOn' || key === 'loudnessOn'
                   || key === 'stereoOn' || key === 'dynamicsOn' || key === 'historyOn') {
          uiState[key] = !!val;
        }
        return {};
      },
      async reset(hostCtx) {
        clearJsAnalysis();
        hostCtx.sendAction(1, 0);
        metaDirty = true;
        return {};
      },
      async captureRef(hostCtx) {
        hostCtx.sendAction(2, 0);
        metaDirty = true;
        return {};
      },
      async clearRef(hostCtx) {
        hostCtx.sendAction(3, 0);
        metaDirty = true;
        return {};
      },
    },
    onFrame(hostCtx, now) {
      const m = hostCtx.latestWasmMeters;
      const g = (i, fb) => (m.length > i && Number.isFinite(m[i])) ? m[i] : fb;

      const momentary = g(0, -70);
      const shortTerm = g(1, -70);
      const integrated = g(2, -70);
      const lra = g(3, 0);
      const tpL = g(4, -100);
      const tpR = g(5, -100);
      const corr = g(6, 0);
      const width = g(7, 0);
      const balance = g(8, 0);

      const pitchVoiced = g(28, 0) > 0.5;
      const pitchHz = g(29, 0);
      const pitchCents = g(30, 0);
      const pitchConf = g(31, 0);

      const hasRef = g(41, 0) > 0.5;
      const refDeltaLufs = g(42, 0);
      const refDeltaTp = g(43, 0);
      const refDeltaCrest = g(44, 0);
      for (let i = 0; i < 10; i++) refTonalBands[i] = g(45 + i, -140);

      const sr = hostCtx.getSampleRate() || 48000;
      const dtSec = lastFrameMs > 0 ? clamp((now - lastFrameMs) * 0.001, 0.005, 0.1) : 0.033;
      lastFrameMs = now;

      if (hostCtx.audio && hostCtx.audio.postAn && hostCtx.computeSpecBins) {
        if (uiState.spectrumOn) {
          hostCtx.computeSpecBins(hostCtx.audio.postAn, fftStereo, 10, 24000);
        }
      }
      if (hostCtx.audio && hostCtx.audio.postAnL && hostCtx.audio.postAnR) {
        hostCtx.audio.postAnL.getFloatTimeDomainData(timeL);
        hostCtx.audio.postAnR.getFloatTimeDomainData(timeR);
        if (uiState.spectrumOn && uiState.specChan === 'ms') {
          computeMsSpectrum(0, sr, fftMid);
          computeMsSpectrum(1, sr, fftSide);
        }
        updateWaveAndGonio(sr, dtSec);
        if (uiState.scopeOn && uiState.scopeMode !== 'rolling') {
          updateCycleScope(sr, pitchVoiced, pitchHz);
        }
      }

      if (now - lastHistPushMs >= 100) {
        lastHistPushMs = now;
        histMom[histWrite] = momentary;
        histSt[histWrite] = shortTerm;
        histWrite = (histWrite + 1) % K_HIST;
      }

      // Assemble KindMeterSuite = 3 packet in-place (zero allocations)
      telem[0] = momentary;
      telem[1] = shortTerm;
      telem[2] = integrated;
      telem[3] = lra;
      telem[4] = tpL;
      telem[5] = tpR;
      telem[6] = corr;
      telem[7] = width;
      telem[8] = balance;
      for (let b = 0; b < 8; b++) telem[9 + b] = g(9 + b, 0);
      telem[17] = K_GONIO;
      telem[18] = K_HIST;

      let off = 19;
      telem.set(fftStereo, off); off += SPEC_BINS;
      telem.set(fftMid, off); off += SPEC_BINS;
      telem.set(fftSide, off); off += SPEC_BINS;
      telem.set(fftSc, off); off += SPEC_BINS;

      for (let i = 0; i < K_WAVE; i++) telem[off + i] = waveMin[(waveWriteCol + i) % K_WAVE];
      off += K_WAVE;
      for (let i = 0; i < K_WAVE; i++) telem[off + i] = waveMax[(waveWriteCol + i) % K_WAVE];
      off += K_WAVE;
      for (let i = 0; i < K_WAVE; i++) telem[off + i] = waveRms[(waveWriteCol + i) % K_WAVE];
      off += K_WAVE;
      telem.set(waveSc, off);
      off += K_WAVE;

      telem.set(cycleMid, off); off += K_CYCLE;
      telem.set(cycleSide, off); off += K_CYCLE;
      telem.set(cycleSc, off); off += K_CYCLE;

      for (let i = 0; i < K_GONIO; i++) {
        const idx = (gonioWrite + i) % K_GONIO;
        telem[off++] = gonioMid[idx];
        telem[off++] = gonioSide[idx];
      }

      for (let i = 0; i < K_HIST; i++) telem[off + i] = histMom[(histWrite + i) % K_HIST];
      off += K_HIST;
      for (let i = 0; i < K_HIST; i++) telem[off + i] = histSt[(histWrite + i) % K_HIST];
      off += K_HIST;

      // 25-float extended trailer
      telem[off++] = g(17, 0);     // plr
      telem[off++] = g(18, 0);     // psr
      telem[off++] = g(19, 0);     // crestFactorStereo
      telem[off++] = g(20, -100);  // vuLeft
      telem[off++] = g(21, -100);  // vuRight
      telem[off++] = g(22, -100);  // k12Left
      telem[off++] = g(23, -100);  // k12Right
      telem[off++] = g(24, -100);  // k14Left
      telem[off++] = g(25, -100);  // k14Right
      telem[off++] = g(26, -100);  // k20Left
      telem[off++] = g(27, -100);  // k20Right
      telem[off++] = pitchVoiced ? 1.0 : 0.0;
      telem[off++] = pitchVoiced ? pitchHz : 0.0;
      telem[off++] = pitchVoiced ? pitchCents : 0.0;
      telem[off++] = pitchConf;
      for (let i = 0; i < 9; i++) telem[off++] = g(32 + i, 0);
      telem[off++] = hasRef ? refDeltaLufs : 0.0;

      hostCtx.pushTelemetry(3, hasRef ? 2 : 0, telem, telemSeq++);

      if (metaDirty || hasRef !== lastMetaHasRef) {
        metaDirty = false;
        lastMetaHasRef = hasRef;
        snapMeta.hasRef = hasRef;
        snapMeta.refDeltaLufs = refDeltaLufs;
        snapMeta.refDeltaTp = refDeltaTp;
        snapMeta.refDeltaCrest = refDeltaCrest;
        hostCtx.emit('snapshot', snapMeta);
      }
    },
  };
})();
