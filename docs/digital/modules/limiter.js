(() => {
  'use strict';

  let wasPlaying = false;

  window.__WD_PLUGIN_SPEC__ = {
    slug: 'limiter',
    title: 'Werewolf Digital Limiter',
    defaultStem: 'Drums',
    needsStereoAnalysers: false,

    presets: [
      {
        name: 'Streaming Master -1 dBTP',
        values: { ceiling: -1.0, threshold: -4.5, clipsplit: 35.0, style: 0, adaptive: false, clipos: 0 },
      },
      {
        name: 'Club Loud Clip-Limit',
        values: { ceiling: -0.3, threshold: -7.0, clipsplit: 65.0, style: 2, adaptive: false, clipos: 0 },
      },
      {
        name: 'Drum Bus Punch',
        values: { ceiling: -0.5, threshold: -5.0, clipsplit: 50.0, style: 1, adaptive: false, clipos: 0 },
      },
      {
        name: 'Flatline Hybrid+ Master',
        values: { ceiling: -1.0, threshold: -6.5, clipsplit: 50.0, mode: 2, style: 1, adaptive: true, clipos: 1 },
      },
      {
        name: 'Anti-Sizzle Clip+ Drums',
        values: { ceiling: -0.5, threshold: -5.5, clipsplit: 100.0, mode: 1, adaptive: true, clipos: 1 },
      },
    ],

    params: [
      { id: 'threshold',   kind: 'slider', min: -24.0, max: 0.0,   def: 0.0 },
      { id: 'ceiling',     kind: 'slider', min: -12.0, max: 0.0,   def: -1.0 },
      { id: 'release',     kind: 'slider', min: 20.0,  max: 800.0, def: 100.0 },
      { id: 'autoRelease', kind: 'toggle', def: false },
      { id: 'style',       kind: 'combo',  choices: ['Transparent', 'Punchy', 'Loud'], def: 0 },
      { id: 'truePeak',    kind: 'toggle', def: true },
      { id: 'link',        kind: 'slider', min: 0.0,   max: 100.0, def: 100.0 },
      { id: 'delta',       kind: 'toggle', def: false },
      { id: 'power',       kind: 'toggle', def: true },
      { id: 'clipthresh',  kind: 'slider', min: -24.0, max: 6.0,   def: 6.0 },
      { id: 'threshauto',  kind: 'toggle', def: true },
      { id: 'clipshape',   kind: 'slider', min: 0.0,   max: 100.0, def: 0.0 },
      { id: 'clipasym',    kind: 'toggle', def: false },
      { id: 'mode',        kind: 'combo',  choices: ['Limit', 'Clip', 'Clip + Limit'], def: 2 },
      { id: 'clipsplit',   kind: 'slider', min: 0.0,   max: 100.0, def: 50.0 },
      { id: 'adaptive',    kind: 'toggle', def: false },
      { id: 'clipos',      kind: 'combo',  choices: ['1x ADAA', 'Selective 8x', 'Selective 16x'], def: 0 },
    ],

    onFrame: hostCtx => {
      const playing = !!(hostCtx.audio && hostCtx.audio.playing);
      const m = hostCtx.latestWasmMeters || [];

      if (playing && m.length >= 14) {
        wasPlaying = true;
        const grL = m.length >= 22 ? m[14] : m[6];
        const grR = m.length >= 22 ? m[15] : m[6];
        const clipGrL = m.length >= 22 ? m[16] : m[7];
        const clipGrR = m.length >= 22 ? m[17] : m[7];
        const clipInL = m.length >= 22 ? m[18] : m[1];
        const clipInR = m.length >= 22 ? m[19] : m[2];
        const clipOutL = m.length >= 22 ? m[20] : m[4];
        const clipOutR = m.length >= 22 ? m[21] : m[5];

        hostCtx.emit('meters', {
          in: m[0],
          inL: m[1],
          inR: m[2],
          out: m[3],
          outL: m[4],
          outR: m[5],
          gr: m[6],
          grL,
          grR,
          clipGr: m[7],
          clipGrL,
          clipGrR,
          clipInL,
          clipInR,
          clipOutL,
          clipOutR,
          lufsM: m[8],
          lufsS: m[9],
          lufsI: m[10],
          tpL: m[11],
          tpR: m[12],
          truePeakL: m[11],
          truePeakR: m[12],
          effClipThresh: m[13],
          effClipThreshDb: m[13],
          grSamples: [m[6]],
          grHistory: [m[6]],
        });
      } else if (wasPlaying) {
        wasPlaying = false;
        hostCtx.emit('meters', {
          in: -120, inL: -120, inR: -120,
          out: -120, outL: -120, outR: -120,
          gr: 0, grL: 0, grR: 0,
          clipGr: 0, clipGrL: 0, clipGrR: 0,
          clipInL: -120, clipInR: -120,
          clipOutL: -120, clipOutR: -120,
          lufsM: -100, lufsS: -100, lufsI: -100,
          tpL: -120, tpR: -120, truePeakL: -120, truePeakR: -120,
          effClipThresh: 6, effClipThreshDb: 6,
          grSamples: [], grHistory: [],
        });
      }
    },
  };
})();
