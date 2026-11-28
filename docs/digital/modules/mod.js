(() => {
  'use strict';

  function buildModParams() {
    const list = [
      { id: 'mode', kind: 'combo', choices: ['Chorus', 'Flanger', 'Phaser', 'Ensemble', 'Rotary', 'Tremolo', 'Vibrato'], def: 0 },
      { id: 'rate', kind: 'slider', min: 0.05, max: 20.0, center: 1.0, def: 1.0 },
      { id: 'depth', kind: 'slider', min: 0.0, max: 1.0, def: 0.5 },
      { id: 'feedback', kind: 'slider', min: -0.90, max: 0.90, def: 0.0 },
      { id: 'mix', kind: 'slider', min: 0.0, max: 1.0, def: 0.5 },
      { id: 'stereowidth', kind: 'slider', min: 0.0, max: 360.0, def: 180.0 },
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
    list.push({ id: 'power', kind: 'toggle', def: true });
    return list;
  }

  window.__WD_PLUGIN_SPEC__ = {
    slug: 'mod',
    title: 'Modulation',
    defaultStem: 'E-Guitar',
    needsStereoAnalysers: false,
    presets: [
      {
        name: 'Lush Dimension Chorus',
        values: { mode: 0, mix: 0.42 },
      },
      {
        name: 'Jet Through-Zero',
        values: { mode: 1, mix: 0.55 },
      },
      {
        name: 'Warm Swirl Phaser',
        values: { mode: 2, mix: 0.50 },
      },
    ],
    params: buildModParams(),
    onFrame(hostCtx) {
      const m = hostCtx.latestWasmMeters;
      const has = m && m.length >= 42;
      const sourceVals = has ? m.slice(0, 10) : new Array(10).fill(0);
      const xlfoPhases = has ? m.slice(10, 13) : new Array(3).fill(0);
      const slotVals = has ? m.slice(13, 37) : new Array(24).fill(0);
      const destOffsets = has ? m.slice(37, 42) : new Array(5).fill(0);
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
