(() => {
  'use strict';

  const SYNC_DIVS = [
    '1/64', '1/64t', '1/64d',
    '1/32', '1/32t', '1/32d',
    '1/16', '1/16t', '1/16d',
    '1/8',  '1/8t',  '1/8d',
    '1/4',  '1/4t',  '1/4d',
    '1/2',  '1/2t',  '1/2d',
    '1/1',  '1/1t',  '1/1d',
  ];

  function buildDelayParams() {
    const list = [
      { id: 'mix', kind: 'slider', min: 0.0, max: 100.0, def: 50.0 },
      { id: 'tapemode', kind: 'combo', choices: ['Digital', 'Tape'], def: 0 },
      { id: 'inputtrim', kind: 'slider', min: -24.0, max: 24.0, def: 0.0 },
      { id: 'outputtrim', kind: 'slider', min: -24.0, max: 24.0, def: 0.0 },
      { id: 'power', kind: 'combo', choices: ['Off', 'On'], def: 1 },
      { id: 'freeze', kind: 'combo', choices: ['Off', 'On'], def: 0 },
      { id: 'routing', kind: 'combo', choices: ['Normal', 'Ping-Pong', 'Cross'], def: 0 },
      { id: 'duckthresh', kind: 'slider', min: -60.0, max: 0.0, def: -40.0 },
      { id: 'duckdepth', kind: 'slider', min: 0.0, max: 24.0, def: 0.0 },
      { id: 'duckrelease', kind: 'slider', min: 10.0, max: 1000.0, center: 150.0, def: 150.0 },
      { id: 'tapa_time', kind: 'slider', min: 1.0, max: 4000.0, center: 500.0, def: 500.0 },
      { id: 'tapa_sync', kind: 'combo', choices: ['Off', 'On'], def: 0 },
      { id: 'tapa_syncdiv', kind: 'combo', choices: SYNC_DIVS, def: 12 },
      { id: 'tapa_level', kind: 'slider', min: 0.0, max: 100.0, def: 100.0 },
      { id: 'tapa_pan', kind: 'slider', min: -100.0, max: 100.0, def: -100.0 },
      { id: 'tapa_invert', kind: 'combo', choices: ['Normal', 'Inverted'], def: 0 },
      { id: 'tapb_time', kind: 'slider', min: 1.0, max: 4000.0, center: 500.0, def: 500.0 },
      { id: 'tapb_sync', kind: 'combo', choices: ['Off', 'On'], def: 0 },
      { id: 'tapb_syncdiv', kind: 'combo', choices: SYNC_DIVS, def: 12 },
      { id: 'tapb_level', kind: 'slider', min: 0.0, max: 100.0, def: 100.0 },
      { id: 'tapb_pan', kind: 'slider', min: -100.0, max: 100.0, def: 100.0 },
      { id: 'tapb_invert', kind: 'combo', choices: ['Normal', 'Inverted'], def: 0 },
      { id: 'feedback', kind: 'slider', min: 0.0, max: 120.0, def: 0.0 },
      { id: 'cross', kind: 'slider', min: 0.0, max: 100.0, def: 0.0 },
      { id: 'hp', kind: 'slider', min: 10.0, max: 2000.0, center: 150.0, def: 10.0 },
      { id: 'lp', kind: 'slider', min: 200.0, max: 20000.0, center: 2000.0, def: 20000.0 },
      { id: 'drive', kind: 'slider', min: 0.0, max: 36.0, def: 0.0 },
      { id: 'diffusion', kind: 'slider', min: 0.0, max: 100.0, def: 0.0 },
    ];
    for (let i = 1; i <= 3; i++) {
      list.push({ id: `xlfo${i}rate`, kind: 'slider', min: 0.02, max: 30.0, center: 1.0, def: 1.0 });
      list.push({ id: `xlfo${i}phase`, kind: 'slider', min: 0.0, max: 360.0, def: 0.0 });
      list.push({ id: `xlfo${i}snap`, kind: 'slider', min: 0.0, max: 100.0, def: 0.0 });
      list.push({ id: `xlfo${i}balance`, kind: 'toggle', def: false });
    }
    for (let s = 1; s <= 24; s++) {
      list.push({ id: `slot${s}depth`, kind: 'slider', min: -2.0, max: 2.0, def: 0.0 });
    }
    list.push({ id: 'delta', kind: 'toggle', def: false });
    list.push({ id: 'ducksource', kind: 'combo', choices: ['Internal', 'External'], def: 0 });
    return list;
  }

  window.__WD_PLUGIN_SPEC__ = {
    slug: 'delay',
    title: 'Delay',
    defaultStem: 'E-Guitar',
    needsStereoAnalysers: false,
    presets: [
      {
        name: 'Analog Dotted 8th',
        values: { feedback: 38.0, mix: 26.0 },
      },
      {
        name: 'Wide Slapback',
        values: { feedback: 12.0, mix: 22.0 },
      },
    ],
    params: buildDelayParams(),
    onFrame(hostCtx) {
      const m = hostCtx.latestWasmMeters;
      const has = m && m.length >= 49;
      const inL = has && Number.isFinite(m[0]) ? m[0] : -120;
      const inR = has && Number.isFinite(m[1]) ? m[1] : -120;
      const outL = has && Number.isFinite(m[2]) ? m[2] : -120;
      const outR = has && Number.isFinite(m[3]) ? m[3] : -120;
      const ducking = has && Number.isFinite(m[4]) ? m[4] : 0;

      hostCtx.emit('meters', { inL, inR, outL, outR, ducking, bpm: 120 });

      const sourceVals = has ? m.slice(5, 15) : new Array(10).fill(0);
      const xlfoPhases = has ? m.slice(15, 18) : new Array(3).fill(0);
      const slotVals = has ? m.slice(18, 42) : new Array(24).fill(0);
      const destOffsets = has ? m.slice(42, 49) : new Array(7).fill(0);
      const modState = hostCtx.getModState ? hostCtx.getModState() : null;

      hostCtx.emit('modState', {
        sourceVals,
        xlfoPhases,
        slotVals,
        destOffsets,
        followerExtSc: !!(modState && modState.followerExtSc),
      });
    },
  };
})();
