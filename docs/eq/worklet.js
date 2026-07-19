// AudioWorkletProcessor hosting the PrismEq wasm instance.
//
// Output 0 = processed signal, output 1 = post-input-trim tap so the page
// can hang an analyser on the same "pre" point the plugin uses. Controls
// arrive as one flat message ({globals, bands}) and are applied atomically.

const BAND_STRIDE = 7; // on, shape, chan, freq, gain, q, slope

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
    this.wasm.prism_set_globals(g[0], g[1], g[2], g[3], g[4], g[5], g[6]);
    const b = msg.bands;
    for (let i = 0; i < 24; i++) {
      const o = i * BAND_STRIDE;
      this.wasm.prism_set_band(i, b[o], b[o + 1], b[o + 2],
                               b[o + 3], b[o + 4], b[o + 5], b[o + 6]);
    }
    this.wasm.prism_apply();
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const out = outputs[0];
    const pre = outputs[1];
    const n = out[0].length;

    if (!this.ready || !input || input.length === 0) {
      for (let ch = 0; ch < out.length; ch++) {
        const src = input && input[Math.min(ch, input.length - 1)];
        if (src) out[ch].set(src); else out[ch].fill(0);
        if (pre && pre[ch]) { if (src) pre[ch].set(src); else pre[ch].fill(0); }
      }
      return true;
    }

    this.refreshViews();
    const f32 = this.f32;
    f32.set(input[0], this.inL);
    f32.set(input[1] || input[0], this.inR);

    this.wasm.prism_process(n, 2);

    out[0].set(f32.subarray(this.inL, this.inL + n));
    if (out[1]) out[1].set(f32.subarray(this.inR, this.inR + n));
    if (pre && pre[0]) pre[0].set(f32.subarray(this.preL, this.preL + n));
    if (pre && pre[1]) pre[1].set(f32.subarray(this.preR, this.preR + n));

    if (--this.meterCountdown <= 0) {
      this.meterCountdown = 8; // ~every 8 quanta ≈ 21 ms at 48 kHz
      this.port.postMessage({
        type: 'meters',
        in: this.wasm.prism_input_db(),
        out: this.wasm.prism_output_db(),
      });
    }
    return true;
  }
}

registerProcessor('wd-prism', PrismWorklet);
