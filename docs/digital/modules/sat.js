(() => {
  'use strict';

  const CHAR_CHOICES = ['Tanh', 'Diode', 'Asymmetric', 'Tape', 'Tube', 'Transformer', 'Fold'];
  const UI_BINS = 160;
  const FFT_BINS = 240;
  const pre240 = new Float32Array(FFT_BINS).fill(-120);
  const post240 = new Float32Array(FFT_BINS).fill(-120);
  const zero10 = new Array(10).fill(0);
  const zero3 = new Array(3).fill(0);
  const zero24 = new Array(24).fill(0);
  const zero64 = new Array(64).fill(0);
  const idleActivity = [-60, -60, -60, -60];

  function downsample240To160(src240) {
    const out = new Array(UI_BINS);
    for (let j = 0; j < UI_BINS; j++) {
      const i0 = Math.floor((j * FFT_BINS) / UI_BINS);
      const i1 = Math.min(FFT_BINS - 1, Math.ceil(((j + 1) * FFT_BINS) / UI_BINS) - 1);
      let pk = src240[i0];
      for (let k = i0 + 1; k <= i1; k++) {
        if (src240[k] > pk) pk = src240[k];
      }
      out[j] = Number.isFinite(pk) ? pk : -120;
    }
    return out;
  }

  const params = [
    { id: 'drive',     kind: 'slider', min: 0.0,   max: 36.0,    def: 0.0 },
    { id: 'character', kind: 'combo',  choices: CHAR_CHOICES,    def: 0 },
    { id: 'mix',       kind: 'slider', min: 0.0,   max: 100.0,   def: 100.0 },
    { id: 'output',    kind: 'slider', min: -24.0, max: 24.0,    def: 0.0 },
    { id: 'aa',        kind: 'toggle',                           def: true },
    { id: 'power',     kind: 'toggle',                           def: true },
    { id: 'delta',     kind: 'toggle',                           def: false },
    { id: 'bandcount', kind: 'slider', min: 1,     max: 4,       interval: 1, def: 1 },
    { id: 'split1',    kind: 'slider', min: 20.0,  max: 20000.0, center: 150.0,  def: 150.0 },
    { id: 'split2',    kind: 'slider', min: 20.0,  max: 20000.0, center: 600.0,  def: 600.0 },
    { id: 'split3',    kind: 'slider', min: 20.0,  max: 20000.0, center: 2500.0, def: 2500.0 },
  ];

  for (let b = 1; b <= 4; b++) {
    params.push(
      { id: `banddrive${b}`,  kind: 'slider', min: 0.0,   max: 36.0,  def: 0.0 },
      { id: `bandchar${b}`,   kind: 'combo',  choices: CHAR_CHOICES, def: 0 },
      { id: `bandmix${b}`,    kind: 'slider', min: 0.0,   max: 100.0, def: 100.0 },
      { id: `bandlevel${b}`,  kind: 'slider', min: -12.0, max: 12.0,  def: 0.0 },
      { id: `bandsolo${b}`,   kind: 'toggle',                        def: false },
      { id: `bandbypass${b}`, kind: 'toggle',                        def: false },
    );
  }

  for (let i = 1; i <= 3; i++) {
    params.push(
      { id: `xlfo${i}rate`,    kind: 'slider', min: 0.02, max: 30.0,  center: 1.0, def: 1.0 },
      { id: `xlfo${i}phase`,   kind: 'slider', min: 0.0,  max: 360.0, def: 0.0 },
      { id: `xlfo${i}snap`,    kind: 'slider', min: 0.0,  max: 100.0, def: 0.0 },
      { id: `xlfo${i}balance`, kind: 'toggle',                        def: false },
    );
  }

  for (let s = 1; s <= 24; s++) {
    params.push({ id: `slot${s}depth`, kind: 'slider', min: -2.0, max: 2.0, def: 0.0 });
  }

  params.push(
    { id: 'envdrive', kind: 'slider', min: -36.0, max: 36.0,   def: 0.0 },
    { id: 'envsens',  kind: 'slider', min: -12.0, max: 24.0,   def: 0.0 },
    { id: 'envatk',   kind: 'slider', min: 0.1,   max: 200.0,  center: 10.0,  def: 10.0 },
    { id: 'envrel',   kind: 'slider', min: 5.0,   max: 1000.0, center: 100.0, def: 100.0 },
    { id: 'envext',   kind: 'toggle',                          def: false },
  );

  window.__WD_PLUGIN_SPEC__ = {
    slug: 'sat',
    title: 'Saturator',
    defaultStem: 'Drums',
    needsStereoAnalysers: false,
    presets: [
      { name: '2-Inch Mastering Tape', values: { drive: 18.0, character: 3, mix: 65.0 } },
      { name: 'Warm Triode Push',      values: { drive: 32.0, character: 4, mix: 80.0 } },
    ],
    params,
    onFrame(hostCtx) {
      const m = hostCtx.latestWasmMeters;
      if (Array.isArray(m) && m.length >= 105) {
        hostCtx.emit('modState', {
          sourceVals: m.slice(4, 14),
          xlfoPhases: m.slice(14, 17),
          slotVals: m.slice(17, 41),
          destOffsets: m.slice(41, 105),
        });
      } else {
        hostCtx.emit('modState', {
          sourceVals: zero10,
          xlfoPhases: zero3,
          slotVals: zero24,
          destOffsets: zero64,
        });
      }

      const activity = (Array.isArray(m) && m.length >= 4) ? m.slice(0, 4) : idleActivity;
      let pre = null;
      let post = null;
      if (typeof hostCtx.computeSpecBins === 'function' && hostCtx.audio) {
        const hasPre = hostCtx.computeSpecBins(hostCtx.audio.preAn, pre240, 20, 20000);
        const hasPost = hostCtx.computeSpecBins(hostCtx.audio.postAn, post240, 20, 20000);
        if (hasPre || hostCtx.audio.playing) pre = downsample240To160(pre240);
        if (hasPost || hostCtx.audio.playing) post = downsample240To160(post240);
      }

      const payload = { activity, scActive: false };
      if (pre) payload.pre = pre;
      if (post) payload.post = post;
      hostCtx.emit('satMeters', payload);
    },
  };
})();
