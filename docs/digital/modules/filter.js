(() => {
  'use strict';

  const MODE_CHOICES = ['LP12', 'LP24', 'BP12', 'BP24', 'HP12', 'HP24', 'Notch', 'Peak'];
  const CHAR_CHOICES = ['Clean', 'Tube', 'Tape', 'Fold'];
  const ROUTING_CHOICES = ['Series', 'Parallel', 'Split L-R', 'Split M-S'];

  const FFT_BINS = 240;
  const pre240 = new Float32Array(FFT_BINS).fill(-120);
  const post240 = new Float32Array(FFT_BINS).fill(-120);
  const frame480 = new Float32Array(FFT_BINS * 2).fill(-120);
  const zero10 = new Array(10).fill(0);
  const zero3 = new Array(3).fill(0);
  const zero24 = new Array(24).fill(0);
  const zero12 = new Array(12).fill(0);
  let telSeq = 0;

  const params = [
    // Block A (0..6)
    { id: 'freqA',      kind: 'slider', min: 20.0,   max: 20000.0, center: 1000.0, def: 1000.0 },
    { id: 'resoA',      kind: 'slider', min: 0.0,    max: 100.0,   def: 15.0 },
    { id: 'modeA',      kind: 'combo',  choices: MODE_CHOICES,     def: 1 },
    { id: 'driveA',     kind: 'slider', min: 0.0,    max: 24.0,    def: 0.0 },
    { id: 'characterA', kind: 'combo',  choices: CHAR_CHOICES,     def: 0 },
    { id: 'panA',       kind: 'slider', min: -100.0, max: 100.0,   def: 0.0 },
    { id: 'levelA',     kind: 'slider', min: -24.0,  max: 12.0,    def: 0.0 },

    // Block B (7..13)
    { id: 'freqB',      kind: 'slider', min: 20.0,   max: 20000.0, center: 1000.0, def: 1000.0 },
    { id: 'resoB',      kind: 'slider', min: 0.0,    max: 100.0,   def: 15.0 },
    { id: 'modeB',      kind: 'combo',  choices: MODE_CHOICES,     def: 1 },
    { id: 'driveB',     kind: 'slider', min: 0.0,    max: 24.0,    def: 0.0 },
    { id: 'characterB', kind: 'combo',  choices: CHAR_CHOICES,     def: 0 },
    { id: 'panB',       kind: 'slider', min: -100.0, max: 100.0,   def: 0.0 },
    { id: 'levelB',     kind: 'slider', min: -24.0,  max: 12.0,    def: 0.0 },

    // Global (14..16)
    { id: 'routing',    kind: 'combo',  choices: ROUTING_CHOICES,  def: 0 },
    { id: 'mix',        kind: 'slider', min: 0.0,    max: 100.0,   def: 100.0 },
    { id: 'power',      kind: 'toggle',                            def: true },
  ];

  // XLFO 1..3 (17..28)
  for (let i = 1; i <= 3; i++) {
    params.push(
      { id: `xlfo${i}rate`,    kind: 'slider', min: 0.02, max: 30.0,  center: 1.0, def: 1.0 },
      { id: `xlfo${i}phase`,   kind: 'slider', min: 0.0,  max: 360.0, def: 0.0 },
      { id: `xlfo${i}snap`,    kind: 'slider', min: 0.0,  max: 100.0, def: 0.0 },
      { id: `xlfo${i}balance`, kind: 'toggle',                        def: false },
    );
  }

  // Slot depths 1..24 (29..52)
  for (let s = 1; s <= 24; s++) {
    params.push({ id: `slot${s}depth`, kind: 'slider', min: -2.0, max: 2.0, def: 0.0 });
  }

  // Delta (53)
  params.push({ id: 'delta', kind: 'toggle', def: false });

  window.__WD_PLUGIN_SPEC__ = {
    slug: 'filter',
    title: 'Filter',
    defaultStem: 'Keys',
    needsStereoAnalysers: false,
    presets: [
      { name: 'Warm Analog Sweep', values: { mix: 100.0 } },
      { name: 'Dual Band Sculpt',  values: { mix: 85.0 } },
    ],
    params,
    onFrame(hostCtx) {
      const m = hostCtx.latestWasmMeters;
      const ms = typeof hostCtx.getModState === 'function' ? hostCtx.getModState() : null;
      const followerExtSc = !!(ms && ms.followerExtSc);

      if (Array.isArray(m) && m.length >= 51) {
        hostCtx.emit('meters', { inDb: m[0], outDb: m[1] });
        hostCtx.emit('modState', {
          sourceVals: m.slice(2, 12),
          xlfoPhases: m.slice(12, 15),
          slotVals: m.slice(15, 39),
          destOffsets: m.slice(39, 51),
          followerExtSc,
        });
      } else {
        hostCtx.emit('meters', { inDb: -100, outDb: -100 });
        hostCtx.emit('modState', {
          sourceVals: zero10,
          xlfoPhases: zero3,
          slotVals: zero24,
          destOffsets: zero12,
          followerExtSc,
        });
      }

      if (typeof hostCtx.computeSpecBins === 'function' && typeof hostCtx.pushTelemetry === 'function' && hostCtx.audio) {
        const hasPre = hostCtx.computeSpecBins(hostCtx.audio.preAn, pre240, 10, 30000);
        const hasPost = hostCtx.computeSpecBins(hostCtx.audio.postAn, post240, 10, 30000);
        if (hasPre || hasPost || hostCtx.audio.playing) {
          frame480.set(pre240, 0);
          frame480.set(post240, FFT_BINS);
          hostCtx.pushTelemetry(9, 3, frame480, ++telSeq);
        }
      }
    },
  };
})();
