// modules/vox.js — Web demo module spec for Werewolf Digital Vox.
// Matches Source/vox/VoxProcessor.cpp & Source/vox/VoxEditor.cpp.
(() => {
  'use strict';

  const VOCAL_BINS = 240;
  const vocalBins = new Float32Array(VOCAL_BINS).fill(-120);
  const telem = new Float32Array(4 + VOCAL_BINS);
  const voxPayload = { f0: 0, retunedF0: 0, confidence: 0, gate: 0 };
  let telemSeq = 1;

  window.__WD_PLUGIN_SPEC__ = {
    slug: 'vox',
    title: 'Werewolf Digital Vox',
    defaultStem: 'Male Vox',
    needsStereoAnalysers: false,
    presets: [
      { name: 'Natural Pitch Polish', values: { retune: 45.0, humanize: 40.0, formant: 0.0 } },
      { name: 'Hard Modern Pop', values: { retune: 4.0, humanize: 8.0, formant: 0.0 } },
      { name: 'Deep Formant Shift', values: { retune: 35.0, formant: -3.0 } },
    ],
    params: [
      { id: 'input', kind: 'slider', min: -24.0, max: 24.0, def: 0.0 },
      { id: 'mix', kind: 'slider', min: 0.0, max: 100.0, def: 100.0 },
      { id: 'output', kind: 'slider', min: -24.0, max: 24.0, def: 0.0 },
      { id: 'power', kind: 'toggle', def: true },
      {
        id: 'key',
        kind: 'combo',
        choices: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
        def: 0,
      },
      {
        id: 'scale',
        kind: 'combo',
        choices: ['Chromatic', 'Major', 'Minor', 'Pentatonic', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Custom'],
        def: 0,
      },
      { id: 'mask', kind: 'slider', min: 0, max: 4095, interval: 1, def: 4095 },
      { id: 'retune', kind: 'slider', min: 0.0, max: 400.0, center: 20.0, def: 20.0 },
      { id: 'formant', kind: 'slider', min: -12.0, max: 12.0, def: 0.0 },
      { id: 'humanize', kind: 'slider', min: 0.0, max: 100.0, def: 15.0 },
      { id: 'delta', kind: 'toggle', def: false },
    ],
    onFrame(hostCtx) {
      const m = hostCtx.latestWasmMeters;
      const f0 = m.length > 0 && Number.isFinite(m[0]) ? m[0] : 0;
      const retunedF0 = m.length > 1 && Number.isFinite(m[1]) ? m[1] : 0;
      const confidence = m.length > 2 && Number.isFinite(m[2]) ? m[2] : 0;
      const gate = m.length > 3 && Number.isFinite(m[3]) ? m[3] : 0;

      let fresh = false;
      if (hostCtx.computeSpecBins && hostCtx.audio && hostCtx.audio.auxAn) {
        fresh = hostCtx.computeSpecBins(hostCtx.audio.auxAn, vocalBins, 20, 20000);
      } else {
        vocalBins.fill(-120);
      }

      telem[0] = f0;
      telem[1] = retunedF0;
      telem[2] = confidence;
      telem[3] = gate;
      telem.set(vocalBins, 4);

      hostCtx.pushTelemetry(8, fresh ? 1 : 0, telem, telemSeq++);

      voxPayload.f0 = f0;
      voxPayload.retunedF0 = retunedF0;
      voxPayload.confidence = confidence;
      voxPayload.gate = gate;
      hostCtx.emit('voxState', voxPayload);
    },
  };
})();
