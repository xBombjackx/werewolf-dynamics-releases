// AudioWorkletProcessor hosting the PrismEq wasm instance.
//
// Output 0 = processed signal, output 1 = post-input-trim tap so the page
// can hang an analyser on the same "pre" point the plugin uses. Controls
// arrive as one flat message ({globals, bands}) and are applied atomically.

// on, shape, chan, freq, gain, q, slope,
// dynOn, dynRange, dynAuto, dynThr, dynAtk, dynRel, detTrack, detFreq,
// dynRatio, dynKnee, dynLink, satOn, satDrive, satModel, tsMode, tsAmount
const BAND_STRIDE = 23;
const MAX_BLOCK = 2048;

function stubImports(module) {
  // STANDALONE_WASM may import a handful of wasi shims; stub them all.
  const imports = {};
  for (const d of WebAssembly.Module.imports(module)) {
    imports[d.module] = imports[d.module] || {};
    imports[d.module][d.name] =
      d.kind === 'function' ? () => 0 : undefined;
  }
  return imports;
}

class PrismWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.ready = false;
    this.pending = [];
    this.meterCountdown = 0;
    this.port.onmessage = e => this.handle(e.data);

    const module = options.processorOptions.module;
    WebAssembly.instantiate(module, stubImports(module)).then(instance => {
      this.wasm = instance.exports;
      this.wasm.prism_init(sampleRate);
      this.refreshViews();
      this.inL = this.wasm.prism_in(0) >> 2;
      this.inR = this.wasm.prism_in(1) >> 2;
      this.preL = this.wasm.prism_pre(0) >> 2;
      this.preR = this.wasm.prism_pre(1) >> 2;
      for (const msg of this.pending) this.apply(msg);
      this.pending.length = 0;
      this.ready = true;
      this.port.postMessage({ type: 'ready' });
    });
  }

  refreshViews() {
    if (!this.f32 || this.f32.buffer !== this.wasm.memory.buffer)
      this.f32 = new Float32Array(this.wasm.memory.buffer);
  }

  handle(msg) {
    if (!this.ready) { this.pending.push(msg); return; }
    this.apply(msg);
  }

  apply(msg) {
    if (msg.type !== 'controls') return;
    const g = msg.globals;
    this.wasm.prism_set_globals(g[0], g[1], g[2], g[3], g[4], g[5], g[6],
                                g[7], g[8], g[9]);
    const b = msg.bands;
    for (let i = 0; i < 24; i++) {
      const o = i * BAND_STRIDE;
      this.wasm.prism_set_band(i, b[o], b[o + 1], b[o + 2],
                               b[o + 3], b[o + 4], b[o + 5], b[o + 6],
                               b[o + 7], b[o + 8], b[o + 9], b[o + 10],
                               b[o + 11], b[o + 12], b[o + 13], b[o + 14],
                               b[o + 15], b[o + 16], b[o + 17], b[o + 18],
                               b[o + 19], b[o + 20], b[o + 21], b[o + 22]);
    }
    this.wasm.prism_apply();
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const out = outputs[0];
    const pre = outputs[1];
    const n = out && out[0] ? out[0].length : 0;

    if (n <= 0)
      return true;

    if (!this.ready || !input || input.length === 0) {
      for (let ch = 0; ch < out.length; ch++) {
        out[ch].fill(0);
        if (pre && pre[ch]) pre[ch].fill(0);
      }
      return true;
    }

    const inCh0 = input[0];
    const inCh1 = input[1] || input[0];
    for (let offset = 0; offset < n; offset += MAX_BLOCK) {
      const chunk = Math.min(MAX_BLOCK, n - offset);
      this.refreshViews();
      const f32 = this.f32;
      f32.set(inCh0.subarray(offset, offset + chunk), this.inL);
      f32.set(inCh1.subarray(offset, offset + chunk), this.inR);

      this.wasm.prism_process(chunk, 2);

      this.refreshViews();
      const post = this.f32;
      out[0].set(post.subarray(this.inL, this.inL + chunk), offset);
      if (out[1]) out[1].set(post.subarray(this.inR, this.inR + chunk), offset);
      if (pre && pre[0]) pre[0].set(post.subarray(this.preL, this.preL + chunk), offset);
      if (pre && pre[1]) pre[1].set(post.subarray(this.preR, this.preR + chunk), offset);
    }

    if (--this.meterCountdown <= 0) {
      this.meterCountdown = 8; // ~every 8 quanta ≈ 21 ms at 48 kHz
      const rides = new Array(24), dets = new Array(24), thrs = new Array(24);
      for (let b = 0; b < 24; b++) {
        rides[b] = this.wasm.prism_band_ride_db(b);
        dets[b] = this.wasm.prism_band_det_db(b);
        thrs[b] = this.wasm.prism_band_thr_db(b);
      }
      this.port.postMessage({
        type: 'meters',
        in: this.wasm.prism_input_db(),
        out: this.wasm.prism_output_db(),
        ag: this.wasm.prism_autogain_db(),
        rides, dets, thrs,
      });
    }
    return true;
  }
}

registerProcessor('wd-prism', PrismWorklet);
