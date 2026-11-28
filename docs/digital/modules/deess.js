(() => {
  'use strict';

  const SPEC_BINS = 240;
  const preBins = new Float32Array(SPEC_BINS).fill(-120);
  const preBinsArr = new Array(SPEC_BINS).fill(-120);
  let lastSpecFresh = false;
  let wasPlaying = false;

  window.__WD_PLUGIN_SPEC__ = {
    slug: 'deess',
    title: 'Werewolf Digital De-Esser',
    defaultStem: 'Female Vox',
    needsStereoAnalysers: false,

    presets: [
      {
        name: 'Lead Vocal Silk',
        values: { freq: 6800.0, threshold: -26.0, range: 8.0, vocalOnly: true },
      },
      {
        name: 'Harsh Cymbal Tame',
        values: { freq: 8500.0, threshold: -24.0, range: 10.0, vocalOnly: false },
      },
    ],

    params: [
      { id: 'freq',          kind: 'slider', min: 500.0,  max: 16000.0, center: 2800.0, def: 6500.0 },
      { id: 'width',         kind: 'slider', min: 0.5,    max: 4.0,     def: 1.5 },
      { id: 'mode',          kind: 'combo',  choices: ['Bandpass', 'Highpass'], def: 0 },
      { id: 'style',         kind: 'combo',  choices: ['Split', 'Wide'], def: 0 },
      { id: 'threshold',     kind: 'slider', min: -60.0,  max: 0.0,     def: -20.0 },
      { id: 'autoThreshold', kind: 'toggle', def: true },
      { id: 'range',         kind: 'slider', min: 0.0,    max: 24.0,    def: 6.0 },
      { id: 'release',       kind: 'slider', min: 20.0,   max: 200.0,   center: 60.0,   def: 60.0 },
      { id: 'listen',        kind: 'combo',  choices: ['Off', 'Detector', 'Removed'], def: 0 },
      { id: 'mix',           kind: 'slider', min: 0.0,    max: 100.0,   def: 100.0 },
      { id: 'power',         kind: 'toggle', def: true },
      { id: 'vocalOnly',     kind: 'toggle', def: false },
      { id: 'stereoTarget',  kind: 'combo',  choices: ['Stereo', 'Mid', 'Side'], def: 0 },
      { id: 'link',          kind: 'toggle', def: true },
      { id: 'scsource',      kind: 'combo',  choices: ['Internal', 'External'], def: 0 },
    ],

    onFrame: hostCtx => {
      const playing = !!(hostCtx.audio && hostCtx.audio.playing);
      const m = hostCtx.latestWasmMeters || [];

      if (playing && m.length >= 2) {
        wasPlaying = true;
        hostCtx.emit('meters', {
          gr: m[0],
          envelope: m[1],
        });
      } else if (wasPlaying) {
        wasPlaying = false;
        hostCtx.emit('meters', {
          gr: 0,
          envelope: -120,
        });
      }

      if (hostCtx.computeSpecBins && hostCtx.audio) {
        const fresh = playing
          ? hostCtx.computeSpecBins(hostCtx.audio.preAn, preBins, 10, 30000)
          : (preBins.fill(-120), false);
        if (fresh || lastSpecFresh) {
          lastSpecFresh = fresh;
          for (let i = 0; i < SPEC_BINS; i++) preBinsArr[i] = preBins[i];
          hostCtx.emit('spectrum', { pre: preBinsArr });
        }
      }
    },
  };
})();
