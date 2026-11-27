// wd-live — AudioWorkletProcessor hosting a Werewolf Dynamics demo shim
// (a bare .wasm with the wd_* C ABI; see demo/live/wasm/OptoWasm.cpp).
//
// Module-agnostic by design: every shim exports the same eight functions,
// so additional modules can reuse this worklet with different WASM bytes.
//
// processorOptions:
//   module : a compiled WebAssembly.Module (preferred — structured-cloneable)
//   bytes  : ArrayBuffer fallback for engines that refuse to clone a Module
//
// Messages in:  { t: 'p', id, v }   set parameter (natural units)
//               { t: 'reset' }      re-prepare the engine (model/unit/pair
//                                   take effect here)
// Messages out: { t: 'meters', gr, ag, tube, flux, mem, latency }  at ~30 Hz
//               { t: 'ready', latency }                            once
//               { t: 'error', message }                            on failure

const MAX_BLOCK = 2048;

class WdLiveProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.ready = false;
    this.framesSinceMeter = 0;
    this.metersEvery = Math.max(1, Math.round(sampleRate / 30));

    try {
      const { module, bytes } = options.processorOptions ?? {};
      const mod = module ?? new WebAssembly.Module(bytes);
      // The shims are pure math; any imports emscripten emits (wasi stubs)
      // are satisfied with no-ops.
      const stubs = new Proxy({}, { get: () => () => 0 });
      const instance = new WebAssembly.Instance(mod, {
        wasi_snapshot_preview1: stubs, env: stubs,
      });
      this.ex = instance.exports;
      // Standalone wasm defers static constructors to _initialize.
      this.ex._initialize?.();
      this.ex.wd_prepare(sampleRate, MAX_BLOCK);
      // Fixed memory, no growth: these views stay valid forever.
      this.ioL = new Float32Array(this.ex.memory.buffer, this.ex.wd_io_l(), MAX_BLOCK);
      this.ioR = new Float32Array(this.ex.memory.buffer, this.ex.wd_io_r(), MAX_BLOCK);
      this.ready = true;
      this.port.postMessage({ t: 'ready', latency: this.ex.wd_latency() });
    } catch (err) {
      this.port.postMessage({ t: 'error', message: String(err?.message ?? err) });
    }

    this.port.onmessage = (e) => {
      const m = e.data;
      if (!this.ready) return;
      if (m.t === 'p') this.ex.wd_set_param(m.id, m.v);
      else if (m.t === 'reset') {
        this.ex.wd_reset();
        this.port.postMessage({ t: 'ready', latency: this.ex.wd_latency() });
      }
    };
  }

  process(inputs, outputs) {
    const inp = inputs[0], out = outputs[0];
    if (!out || out.length === 0) return true;
    const outL = out[0], outR = out[1] ?? out[0];
    const n = outL.length;
    const inL = inp?.[0];
    const inR = inp?.[1] ?? inL;

    if (!this.ready) {
      // Zero-allocation wire fallback until WASM initialization succeeds.
      const availL = inL ? Math.min(n, inL.length) : 0;
      if (availL > 0) outL.set(inL.subarray(0, availL), 0);
      if (availL < n) outL.fill(0, availL, n);
      if (outR !== outL) {
        const availR = inR ? Math.min(n, inR.length) : 0;
        if (availR > 0) outR.set(inR.subarray(0, availR), 0);
        if (availR < n) outR.fill(0, availR, n);
      }
      return true;
    }

    for (let off = 0; off < n; off += MAX_BLOCK) {
      const chunk = Math.min(MAX_BLOCK, n - off);
      const availL = inL ? Math.max(0, Math.min(chunk, inL.length - off)) : 0;
      if (availL > 0) this.ioL.set(inL.subarray(off, off + availL), 0);
      if (availL < chunk) this.ioL.fill(0, availL, chunk);

      const availR = inR ? Math.max(0, Math.min(chunk, inR.length - off)) : 0;
      if (availR > 0) this.ioR.set(inR.subarray(off, off + availR), 0);
      if (availR < chunk) this.ioR.fill(0, availR, chunk);

      this.ex.wd_process(chunk);
      outL.set(this.ioL.subarray(0, chunk), off);
      if (outR !== outL) outR.set(this.ioR.subarray(0, chunk), off);
    }

    this.framesSinceMeter += n;
    if (this.framesSinceMeter >= this.metersEvery) {
      this.framesSinceMeter = 0;
      this.port.postMessage({
        t: 'meters',
        gr: this.ex.wd_meter(0),
        ag: this.ex.wd_meter(1),
        tube: this.ex.wd_meter(2),
        flux: this.ex.wd_meter(3),
        mem: this.ex.wd_meter(4),
        latency: this.ex.wd_latency(),
      });
    }
    return true;
  }
}

registerProcessor('wd-live', WdLiveProcessor);
