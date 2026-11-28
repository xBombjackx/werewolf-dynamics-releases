(() => {
  'use strict';

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function computeStaticCurveJS(hostCtx) {
    const thresholdDb = clamp(hostCtx.getPlain('threshold'), -60, 0);
    const ratio = hostCtx.getPlain('ratio');
    const kneeDb = clamp(hostCtx.getPlain('knee'), 0, 72);
    const makeupDb = hostCtx.getPlain('makeup');
    const rangeDb = clamp(hostCtx.getPlain('range'), 0, 40);
    const mixPct = clamp(hostCtx.getPlain('mix'), 0, 200);
    const autoGain = hostCtx.getPlain('autogain') > 0.5;
    const scSource = Math.round(hostCtx.getPlain('scsource'));

    const staticGrDb = inDb => {
      let ratioTerm = 1.0;
      if (Number.isFinite(ratio) && ratio < 100.0) {
        ratioTerm = 1.0 - 1.0 / Math.max(1.0, ratio);
      }
      const over = inDb - thresholdDb;
      let grDb = 0.0;
      if (kneeDb <= 0.001) {
        if (over > 0.0) grDb = -over * ratioTerm;
      } else {
        if (over <= -0.5 * kneeDb) grDb = 0.0;
        else if (over >= 0.5 * kneeDb) grDb = -over * ratioTerm;
        else {
          const t = over + 0.5 * kneeDb;
          grDb = -(t * t / (2.0 * kneeDb)) * ratioTerm;
        }
      }
      if (rangeDb < 40.0) grDb = Math.max(grDb, -rangeDb);
      return grDb * (mixPct / 100.0);
    };

    let autoGainDb = 0.0;
    if (autoGain && scSource === 0) {
      const refs = [-24.0, -18.0, -12.0, -6.0];
      const wts = [0.15, 0.35, 0.35, 0.15];
      for (let i = 0; i < 4; i++) autoGainDb += wts[i] * (-staticGrDb(refs[i]));
      autoGainDb = clamp(autoGainDb, 0.0, 24.0);
    }

    const inVals = [];
    const outVals = [];
    for (let db = -80; db <= 20; db++) {
      inVals.push(db);
      outVals.push(db + staticGrDb(db) + makeupDb + autoGainDb);
    }
    return { inVals, outVals };
  }

  function emitStaticCurve(hostCtx) {
    const wasm = hostCtx.wasmUi && hostCtx.wasmUi.wasm;
    if (wasm && typeof wasm.wd_action === 'function' && typeof wasm.wd_aux === 'function') {
      wasm.wd_action(1, 0);
      const ptr = wasm.wd_aux(0) >> 2;
      const f32 = new Float32Array(wasm.memory.buffer, ptr << 2, 101);
      const inVals = new Array(101);
      const outVals = new Array(101);
      for (let i = 0; i < 101; i++) {
        inVals[i] = -80 + i;
        outVals[i] = f32[i];
      }
      hostCtx.emit('staticCurve', { inVals, outVals });
      return;
    }
    hostCtx.emit('staticCurve', computeStaticCurveJS(hostCtx));
  }

  const DET_BINS = 240;
  const detBins = new Float32Array(DET_BINS).fill(-120);
  let seq = 0;
  let lastDetFresh = false;
  let wasPlaying = false;

  window.__WD_PLUGIN_SPEC__ = {
    slug: 'comp',
    title: 'Werewolf Digital Compressor',
    defaultStem: 'Drums',
    needsStereoAnalysers: false,

    presets: [
      {
        name: 'Vocal Smooth',
        values: {
          threshold: -24.0, ratio: 2.5, knee: 12.0, attack: 15.0, release: 180.0,
          autoRelease: false, detector: 40.0, rmsWindow: 30.0, lookahead: 0, schp: 80.0,
        },
      },
      {
        name: 'Drum Punch',
        values: {
          threshold: -18.0, ratio: 4.0, knee: 4.0, attack: 30.0, release: 80.0,
          autoRelease: false, detector: 100.0, rmsWindow: 10.0, lookahead: 1, schp: 60.0, stereolink: 80.0,
        },
      },
      {
        name: 'Bus Glue',
        values: {
          threshold: -10.0, ratio: 2.0, knee: 18.0, attack: 10.0, release: 300.0,
          autoRelease: true, detector: 20.0, rmsWindow: 50.0, lookahead: 0,
        },
      },
      {
        name: 'Limit-ish',
        values: {
          threshold: -12.0, ratio: 100.0, knee: 2.0, attack: 1.0, release: 50.0,
          autoRelease: false, detector: 100.0, rmsWindow: 10.0, lookahead: 2,
        },
      },
      {
        name: 'Gentle Leveler',
        values: {
          threshold: -22.0, ratio: 1.8, knee: 24.0, attack: 40.0, release: 600.0,
          autoRelease: false, detector: 0.0, rmsWindow: 80.0, lookahead: 0,
        },
      },
    ],

    params: [
      { id: 'power',         kind: 'toggle', def: true },
      { id: 'threshold',     kind: 'slider', min: -60.0,  max: 0.0,     def: -20.0 },
      { id: 'ratio',         kind: 'slider', min: 1.0,    max: 100.0,   center: 4.0,    def: 4.0 },
      { id: 'attack',        kind: 'slider', min: 0.1,    max: 100.0,   center: 10.0,   def: 10.0 },
      { id: 'release',       kind: 'slider', min: 1.0,    max: 1000.0,  center: 100.0,  def: 100.0 },
      { id: 'makeup',        kind: 'slider', min: -24.0,  max: 24.0,    def: 0.0 },
      { id: 'knee',          kind: 'slider', min: 0.0,    max: 72.0,    def: 6.0 },
      { id: 'autoRelease',   kind: 'toggle', def: false },
      { id: 'detector',      kind: 'slider', min: 0.0,    max: 100.0,   def: 30.0 },
      { id: 'rmsWindow',     kind: 'slider', min: 1.0,    max: 200.0,   def: 20.0 },
      { id: 'hold',          kind: 'slider', min: 0.0,    max: 500.0,   def: 0.0 },
      { id: 'range',         kind: 'slider', min: 0.0,    max: 40.0,    def: 40.0 },
      { id: 'mix',           kind: 'slider', min: 0.0,    max: 200.0,   def: 100.0 },
      { id: 'lookahead',     kind: 'combo',  choices: ['Off', '2 ms', '5 ms', '10 ms', '20 ms'], def: 0 },
      { id: 'scsource',      kind: 'combo',  choices: ['Internal', 'External'], def: 0 },
      { id: 'schp',          kind: 'slider', min: 0.0,    max: 500.0,   interval: 1.0,  def: 0.0 },
      { id: 'sclp',          kind: 'slider', min: 1000.0, max: 20001.0, interval: 1.0,  def: 20001.0 },
      { id: 'scb1freq',      kind: 'slider', min: 20.0,   max: 20000.0, center: 1000.0, def: 1000.0 },
      { id: 'scb1gain',      kind: 'slider', min: -12.0,  max: 12.0,    def: 0.0 },
      { id: 'scb1q',         kind: 'slider', min: 0.3,    max: 10.0,    def: 1.0 },
      { id: 'scb2freq',      kind: 'slider', min: 20.0,   max: 20000.0, center: 1000.0, def: 1000.0 },
      { id: 'scb2gain',      kind: 'slider', min: -12.0,  max: 12.0,    def: 0.0 },
      { id: 'scb2q',         kind: 'slider', min: 0.3,    max: 10.0,    def: 1.0 },
      { id: 'audition',      kind: 'combo',  choices: ['Off', 'Sidechain EQ', 'Gain Signal', 'Delta'], def: 0 },
      { id: 'autogain',      kind: 'toggle', def: true },
      { id: 'autothreshold', kind: 'toggle', def: false },
      { id: 'stereolink',    kind: 'slider', min: 0.0,    max: 100.0,   def: 100.0 },
      { id: 'routingmode',   kind: 'combo',  choices: ['L/R', 'Mid-Only', 'Side-Only', 'M-Keyed', 'S-Keyed'], def: 0 },
    ],

    nativeFunctions: {
      requestStaticCurve: async hostCtx => {
        emitStaticCurve(hostCtx);
      },
    },

    onParamsChanged: hostCtx => {
      emitStaticCurve(hostCtx);
    },

    onFrame: hostCtx => {
      const playing = !!(hostCtx.audio && hostCtx.audio.playing);
      const m = hostCtx.latestWasmMeters || [];

      if (playing && m.length >= 12) {
        wasPlaying = true;
        hostCtx.emit('meters', {
          gr: m[0],
          grL: m[1],
          grR: m[2],
          in: m[3],
          inL: m[4],
          inR: m[5],
          out: m[6],
          outL: m[7],
          outR: m[8],
          detector: m[9],
          autoGainDb: m[10],
          autoThreshOffsetDb: m[11],
          grHistory: [m[0]],
        });
      } else if (wasPlaying) {
        wasPlaying = false;
        hostCtx.emit('meters', {
          gr: 0, grL: 0, grR: 0,
          in: -120, inL: -120, inR: -120,
          out: -120, outL: -120, outR: -120,
          detector: -70,
          autoGainDb: 0,
          autoThreshOffsetDb: 0,
          grHistory: [0],
        });
      }

      if (hostCtx.computeSpecBins && hostCtx.audio) {
        let fresh = false;
        if (playing) {
          fresh = hostCtx.computeSpecBins(hostCtx.audio.auxAn, detBins, 20, 20000);
          if (!fresh) fresh = hostCtx.computeSpecBins(hostCtx.audio.preAn, detBins, 20, 20000);
        } else {
          detBins.fill(-120);
        }
        if (fresh || lastDetFresh) {
          lastDetFresh = fresh;
          hostCtx.pushTelemetry(7, 2, detBins, ++seq);
        }
      }
    },
  };
})();
