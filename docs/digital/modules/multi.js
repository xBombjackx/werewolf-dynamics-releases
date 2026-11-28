// modules/multi.js — Web demo module spec for Werewolf Digital Multiband.
// Matches Source/multi/MultiProcessor.cpp & Source/multi/MultiEditor.cpp.
(() => {
  'use strict';

  const K_BINS = 240;
  const preBins = new Float32Array(K_BINS).fill(-120);
  const postBins = new Float32Array(K_BINS).fill(-120);
  const scBins = new Float32Array(K_BINS).fill(-120);
  const telem = new Float32Array(15 + 3 * K_BINS);
  const grs = [0, 0, 0, 0, 0, 0];
  const dets = [-70, -70, -70, -70, -70, -70];
  const metersPayload = { in: -70, out: -70, grs, dets };

  const inVals = new Array(101);
  const outVals = new Array(101);
  for (let i = 0; i <= 100; i++) inVals[i] = -80 + i;

  let selectedBand = 0;
  let telemSeq = 1;

  function staticCurveDb(hostCtx, bandIdx, inDb) {
    if (bandIdx < 0 || bandIdx >= 6) return inDb;
    const bs = String(bandIdx + 1);
    const thresholdDb = hostCtx.getPlain('threshold' + bs);
    const ratio = hostCtx.getPlain('ratio' + bs);
    const kneeDb = hostCtx.getPlain('knee' + bs);
    const rangeDb = hostCtx.getPlain('range' + bs);
    const levelDb = hostCtx.getPlain('level' + bs);
    const bypass = hostCtx.getPlain('bypass' + bs) > 0.5;
    const upward = hostCtx.getPlain('upward' + bs) > 0.5;
    const outputTrimDb = hostCtx.getPlain('output');

    if (bypass) return inDb + outputTrimDb;

    let grDb = 0.0;
    const over = inDb - thresholdDb;
    let ratioTerm = 1.0;
    if (Number.isFinite(ratio) && ratio < 100.0) {
      const safeRatio = Math.max(1.0, ratio);
      ratioTerm = 1.0 - 1.0 / safeRatio;
    }

    if (upward) {
      const x = -over;
      if (kneeDb <= 0.001) {
        if (x > 0.0) grDb = x * ratioTerm;
      } else if (x <= -0.5 * kneeDb) {
        grDb = 0.0;
      } else if (x >= 0.5 * kneeDb) {
        grDb = x * ratioTerm;
      } else {
        const t = x + 0.5 * kneeDb;
        grDb = (t * t / (2.0 * kneeDb)) * ratioTerm;
      }
    } else {
      if (kneeDb <= 0.001) {
        if (over > 0.0) grDb = -over * ratioTerm;
      } else if (over <= -0.5 * kneeDb) {
        grDb = 0.0;
      } else if (over >= 0.5 * kneeDb) {
        grDb = -over * ratioTerm;
      } else {
        const t = over + 0.5 * kneeDb;
        grDb = -(t * t / (2.0 * kneeDb)) * ratioTerm;
      }
    }

    let clampedGrDb = grDb;
    if (upward) {
      clampedGrDb = Math.min(grDb, rangeDb);
    } else if (rangeDb < 40.0) {
      clampedGrDb = Math.max(grDb, -rangeDb);
    }

    const mix = hostCtx.getPlain('mix') * 0.01;
    const wetDb = inDb + clampedGrDb + levelDb;
    const dryLin = Math.pow(10.0, inDb / 20.0);
    const wetLin = Math.pow(10.0, wetDb / 20.0);
    const blended = dryLin + mix * (wetLin - dryLin);
    const magnitude = Math.max(Math.abs(blended), 1.0e-7);
    return 20.0 * Math.log10(magnitude) + outputTrimDb;
  }

  function emitStaticCurve(hostCtx) {
    for (let i = 0; i <= 100; i++) {
      outVals[i] = staticCurveDb(hostCtx, selectedBand, inVals[i]);
    }
    hostCtx.emit('staticCurve', {
      band: selectedBand,
      inVals: inVals.slice(),
      outVals: outVals.slice(),
    });
  }

  const params = [
    { id: 'bandCount', kind: 'slider', min: 1, max: 6, interval: 1, def: 3 },
    { id: 'split1', kind: 'slider', min: 20, max: 20000, center: 1000, def: 80 },
    { id: 'split2', kind: 'slider', min: 20, max: 20000, center: 1000, def: 250 },
    { id: 'split3', kind: 'slider', min: 20, max: 20000, center: 1000, def: 1000 },
    { id: 'split4', kind: 'slider', min: 20, max: 20000, center: 1000, def: 4000 },
    { id: 'split5', kind: 'slider', min: 20, max: 20000, center: 1000, def: 12000 },
    { id: 'mix', kind: 'slider', min: 0, max: 200, def: 100 },
    { id: 'output', kind: 'slider', min: -24, max: 24, def: 0 },
    { id: 'stereoLink', kind: 'slider', min: 0, max: 100, def: 100 },
    { id: 'power', kind: 'toggle', def: true },
    { id: 'msMode', kind: 'toggle', def: false },
  ];

  for (let b = 1; b <= 6; b++) {
    const bs = String(b);
    params.push(
      { id: 'threshold' + bs, kind: 'slider', min: -60, max: 12, def: -20 },
      { id: 'ratio' + bs, kind: 'slider', min: 1, max: 20, center: 4, def: 4 },
      { id: 'attack' + bs, kind: 'slider', min: 0.05, max: 250, center: 10, def: 10 },
      { id: 'release' + bs, kind: 'slider', min: 20, max: 2000, center: 100, def: 100 },
      { id: 'autoRelease' + bs, kind: 'toggle', def: false },
      { id: 'range' + bs, kind: 'slider', min: 0, max: 24, def: 24 },
      { id: 'knee' + bs, kind: 'slider', min: 0, max: 30, def: 6 },
      { id: 'level' + bs, kind: 'slider', min: -12, max: 12, def: 0 },
      { id: 'solo' + bs, kind: 'toggle', def: false },
      { id: 'bypass' + bs, kind: 'toggle', def: false },
      { id: 'upward' + bs, kind: 'toggle', def: false },
      { id: 'extKey' + bs, kind: 'toggle', def: false },
    );
  }

  params.push(
    { id: 'delta', kind: 'toggle', def: false },
    { id: 'sclisten', kind: 'toggle', def: false },
  );

  window.__WD_PLUGIN_SPEC__ = {
    slug: 'multi',
    title: 'Werewolf Digital Multiband',
    defaultStem: 'Drums',
    needsStereoAnalysers: false,
    presets: [
      {
        name: 'Glue Master 3-Band',
        values: { bandCount: 3, ratio1: 2.5, ratio2: 2.0, ratio3: 2.5, knee1: 9.0, knee2: 9.0, knee3: 9.0 },
      },
      {
        name: 'OTT Upward Detail',
        values: {
          bandCount: 3,
          upward1: true, upward2: true, upward3: true,
          threshold1: -28.0, threshold2: -30.0, threshold3: -32.0,
          range1: 9.0, range2: 9.0, range3: 10.0,
        },
      },
      {
        name: 'Vocal Presence Control',
        values: { bandCount: 4, split2: 350.0, split3: 3200.0, threshold3: -24.0, ratio3: 4.5 },
      },
    ],
    params,
    nativeFunctions: {
      async selectBand(hostCtx, b) {
        selectedBand = Math.max(0, Math.min(5, (b | 0)));
        emitStaticCurve(hostCtx);
        return {};
      },
      async requestStaticCurve(hostCtx) {
        emitStaticCurve(hostCtx);
        return {};
      },
    },
    onParamsChanged(hostCtx) {
      emitStaticCurve(hostCtx);
    },
    onFrame(hostCtx) {
      const m = hostCtx.latestWasmMeters;
      const inDb = m.length > 0 && Number.isFinite(m[0]) ? m[0] : -70;
      const outDb = m.length > 1 && Number.isFinite(m[1]) ? m[1] : -70;
      for (let b = 0; b < 6; b++) {
        grs[b] = m.length > 2 + b && Number.isFinite(m[2 + b]) ? m[2 + b] : 0;
        dets[b] = m.length > 8 + b && Number.isFinite(m[8 + b]) ? m[8 + b] : -70;
      }

      if (hostCtx.computeSpecBins) {
        hostCtx.computeSpecBins(hostCtx.audio.preAn, preBins, 20, 20000);
        hostCtx.computeSpecBins(hostCtx.audio.postAn, postBins, 20, 20000);
      }

      telem[0] = inDb;
      telem[1] = outDb;
      telem[2] = -120;
      for (let b = 0; b < 6; b++) {
        telem[3 + b] = grs[b];
        telem[9 + b] = dets[b];
      }
      telem.set(preBins, 15);
      telem.set(postBins, 15 + K_BINS);
      telem.set(scBins, 15 + 2 * K_BINS);

      hostCtx.pushTelemetry(5, 0, telem, telemSeq++);

      metersPayload.in = inDb;
      metersPayload.out = outDb;
      hostCtx.emit('meters', metersPayload);
    },
  };
})();
