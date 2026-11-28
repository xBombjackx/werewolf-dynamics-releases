(() => {
  'use strict';

  const MODULE_CHOICES = ['Drive', 'Crush', 'Wobble', 'Filter', 'Noise'];

  function sanitizeChainOrder(raw) {
    const used = [false, false, false, false, false];
    const out = [-1, -1, -1, -1, -1];
    const src = Array.isArray(raw) ? raw : [];
    for (let i = 0; i < 5; i++) {
      const v = Math.round(Number(src[i]));
      if (Number.isFinite(v) && v >= 0 && v < 5 && !used[v]) {
        out[i] = v;
        used[v] = true;
      }
    }
    let nextUnused = 0;
    for (let i = 0; i < 5; i++) {
      if (out[i] < 0) {
        while (nextUnused < 5 && used[nextUnused]) nextUnused++;
        out[i] = nextUnused < 5 ? nextUnused++ : 0;
        used[out[i]] = true;
      }
    }
    return out;
  }

  window.__WD_PLUGIN_SPEC__ = {
    slug: 'retro',
    title: 'Retro',
    defaultStem: 'Keys',
    needsStereoAnalysers: false,
    presets: [
      {
        name: 'Warm Cassette Deck',
        values: {
          age: 42.0,
          drivechar: 2,
          driveAmt: 30.0,
          crushOn: false,
          wobbleAmt: 35.0,
          noisechar: 1,
          noiseAmt: 18.0,
        },
      },
      {
        name: 'Dusty 12-Bit Sampler',
        values: {
          age: 55.0,
          order1: 3,
          order2: 1,
          order3: 0,
          order4: 2,
          order5: 4,
          crushAmt: 42.0,
          filterAmt: 32.0,
        },
      },
      {
        name: 'Filter Into Tape',
        values: {
          age: 48.0,
          order1: 3,
          order2: 0,
          order3: 2,
          order4: 1,
          order5: 4,
          drivechar: 2,
          driveAmt: 45.0,
        },
      },
    ],
    params: [
      { id: 'age', kind: 'slider', min: 0.0, max: 100.0, def: 35.0 },
      { id: 'mix', kind: 'slider', min: 0.0, max: 100.0, def: 100.0 },
      { id: 'output', kind: 'slider', min: -24.0, max: 24.0, def: 0.0 },
      { id: 'power', kind: 'toggle', def: true },
      { id: 'retroautogain', kind: 'toggle', def: true },
      { id: 'driveOn', kind: 'toggle', def: true },
      { id: 'driveAmt', kind: 'slider', min: 0.0, max: 100.0, def: 20.0 },
      { id: 'drivechar', kind: 'combo', choices: ['Tanh', 'Tube', 'Tape', 'Diode', 'Fuzz'], def: 0 },
      { id: 'crushOn', kind: 'toggle', def: true },
      { id: 'crushAmt', kind: 'slider', min: 0.0, max: 100.0, def: 15.0 },
      { id: 'crushchar', kind: 'combo', choices: ['Both', 'Bit-crush', 'Sample-rate'], def: 0 },
      { id: 'wobbleOn', kind: 'toggle', def: true },
      { id: 'wobbleAmt', kind: 'slider', min: 0.0, max: 100.0, def: 25.0 },
      { id: 'wobblechar', kind: 'combo', choices: ['Wow & Flutter', 'Vinyl Warp', 'Chorus-ish'], def: 0 },
      { id: 'filterOn', kind: 'toggle', def: true },
      { id: 'filterAmt', kind: 'slider', min: 0.0, max: 100.0, def: 20.0 },
      { id: 'filterchar', kind: 'combo', choices: ['Speaker', 'Low-pass', 'High-pass', 'Resonant LP'], def: 0 },
      { id: 'noiseOn', kind: 'toggle', def: true },
      { id: 'noiseAmt', kind: 'slider', min: 0.0, max: 100.0, def: 20.0 },
      { id: 'noisechar', kind: 'combo', choices: ['Vinyl', 'Tape Hiss', 'Hum'], def: 0 },
      { id: 'delta', kind: 'toggle', def: false },
      { id: 'order1', kind: 'combo', choices: MODULE_CHOICES, def: 0 },
      { id: 'order2', kind: 'combo', choices: MODULE_CHOICES, def: 1 },
      { id: 'order3', kind: 'combo', choices: MODULE_CHOICES, def: 2 },
      { id: 'order4', kind: 'combo', choices: MODULE_CHOICES, def: 3 },
      { id: 'order5', kind: 'combo', choices: MODULE_CHOICES, def: 4 },
    ],
    nativeFunctions: {
      async setChainOrder(hostCtx, rawArr) {
        const clean = sanitizeChainOrder(rawArr);
        for (let s = 0; s < 5; s++) {
          hostCtx.setPlain('order' + (s + 1), clean[s]);
        }
        return {};
      },
    },
    onFrame(hostCtx) {
      const m = hostCtx.latestWasmMeters;
      const inDb = m && Number.isFinite(m[0]) ? m[0] : -120;
      const outDb = m && Number.isFinite(m[1]) ? m[1] : -120;
      hostCtx.emit('meters', { in: inDb, out: outDb });
    },
  };
})();
