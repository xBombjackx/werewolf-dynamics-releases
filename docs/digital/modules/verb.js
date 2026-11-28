(() => {
  'use strict';

  const SPEC_BINS = 240;
  const wetBins = new Float32Array(SPEC_BINS);
  const specPkt = new Float32Array(7 + SPEC_BINS);

  window.__WD_PLUGIN_SPEC__ = {
    slug: 'verb',
    title: 'Reverb',
    defaultStem: 'Female Vox',
    needsStereoAnalysers: false,
    presets: [
      {
        name: 'Lush Concert Hall',
        values: { mode: 0, decay: 3.4, predelay: 28.0, mix: 28.0 },
      },
      {
        name: 'Vocal Studio Plate',
        values: { mode: 2, decay: 1.8, predelay: 36.0, mix: 22.0 },
      },
      {
        name: 'Tight Drum Room',
        values: { mode: 1, decay: 0.7, predelay: 8.0, mix: 18.0 },
      },
    ],
    params: [
      { id: 'mode', kind: 'combo', choices: ['Hall', 'Room', 'Plate', 'Vintage', 'Ambience', 'Nonlin'], def: 0 },
      { id: 'decay', kind: 'slider', min: 0.1, max: 120.0, center: 2.0, def: 2.0 },
      { id: 'size', kind: 'slider', min: 10.0, max: 200.0, def: 100.0 },
      { id: 'predelay', kind: 'slider', min: 0.0, max: 200.0, def: 20.0 },
      { id: 'dampingHf', kind: 'slider', min: 100.0, max: 22000.0, center: 8000.0, def: 8000.0 },
      { id: 'dampingLf', kind: 'slider', min: 10.0, max: 1000.0, center: 100.0, def: 100.0 },
      { id: 'diffusion', kind: 'slider', min: 0.0, max: 100.0, def: 50.0 },
      { id: 'modrate', kind: 'slider', min: 0.1, max: 5.0, center: 1.0, def: 1.0 },
      { id: 'moddepth', kind: 'slider', min: 0.0, max: 100.0, def: 30.0 },
      { id: 'mix', kind: 'slider', min: 0.0, max: 100.0, def: 35.0 },
      { id: 'width', kind: 'slider', min: 0.0, max: 200.0, def: 100.0 },
      { id: 'balance', kind: 'slider', min: 0.0, max: 100.0, def: 50.0 },
      { id: 'duckthresh', kind: 'slider', min: -60.0, max: 0.0, def: -12.0 },
      { id: 'duckdepth', kind: 'slider', min: 0.0, max: 24.0, def: 0.0 },
      { id: 'duckrelease', kind: 'slider', min: 10.0, max: 1000.0, center: 150.0, def: 150.0 },
      { id: 'hfDecayRatio', kind: 'slider', min: 0.2, max: 2.0, def: 0.5 },
      { id: 'lfDecayRatio', kind: 'slider', min: 0.2, max: 2.0, def: 1.2 },
      { id: 'freeze', kind: 'toggle', def: false },
      { id: 'decayEqEnable', kind: 'toggle', def: false },
      { id: 'eqFreq1', kind: 'slider', min: 20.0, max: 1000.0, center: 200.0, def: 200.0 },
      { id: 'eqMult1', kind: 'slider', min: 0.25, max: 4.0, def: 1.0 },
      { id: 'eqFreq2', kind: 'slider', min: 100.0, max: 4000.0, center: 500.0, def: 500.0 },
      { id: 'eqMult2', kind: 'slider', min: 0.25, max: 4.0, def: 1.0 },
      { id: 'eqFreq3', kind: 'slider', min: 500.0, max: 10000.0, center: 2000.0, def: 2000.0 },
      { id: 'eqMult3', kind: 'slider', min: 0.25, max: 4.0, def: 1.0 },
      { id: 'eqFreq4', kind: 'slider', min: 1000.0, max: 20000.0, center: 6000.0, def: 6000.0 },
      { id: 'eqMult4', kind: 'slider', min: 0.25, max: 4.0, def: 1.0 },
      { id: 'delta', kind: 'toggle', def: false },
      { id: 'power', kind: 'toggle', def: true },
      { id: 'ducksource', kind: 'combo', choices: ['Internal', 'External'], def: 0 },
    ],
    onFrame(hostCtx) {
      const m = hostCtx.latestWasmMeters;
      const inL = m && Number.isFinite(m[0]) ? m[0] : -120;
      const inR = m && Number.isFinite(m[1]) ? m[1] : -120;
      const outL = m && Number.isFinite(m[2]) ? m[2] : -120;
      const outR = m && Number.isFinite(m[3]) ? m[3] : -120;
      const wetDb = m && Number.isFinite(m[4]) ? m[4] : -120;
      const duckDb = m && Number.isFinite(m[5]) ? m[5] : 0;

      if (hostCtx.computeSpecBins && hostCtx.audio && hostCtx.audio.auxAn) {
        hostCtx.computeSpecBins(hostCtx.audio.auxAn, wetBins, 10, 30000);
      } else {
        wetBins.fill(-120);
      }

      specPkt[0] = inL;
      specPkt[1] = inR;
      specPkt[2] = outL;
      specPkt[3] = outR;
      specPkt[4] = wetDb;
      specPkt[5] = duckDb;
      specPkt[6] = -120;
      specPkt.set(wetBins, 7);

      hostCtx.pushTelemetry(2, 8, specPkt);
      hostCtx.emit('meters', { inL, inR, outL, outR, wet: wetDb, duckDb });
    },
  };
})();
