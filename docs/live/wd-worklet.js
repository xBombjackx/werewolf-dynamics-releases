// wd-live — AudioWorkletProcessor hosting a Werewolf Dynamics demo shim
// (a bare .wasm with the wd_* C ABI; see demo/live/wasm/OptoWasm.cpp).
//
// Module-agnostic on purpose: every shim exports the same eight functions,
// so WD Mu later is the same worklet with different bytes.
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

const QUANTUM = 128;

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
      this.ex.wd_prepare(sampleRate, QUANTUM);
      // Fixed memory, no growth: these views stay valid forever.
      this.ioL = new Float32Array(this.ex.memory.buffer, this.ex.wd_io_l(), QUANTUM);
      this.ioR = new Float32Array(this.ex.memory.buffer, this.ex.wd_io_r(), QUANTUM);
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
    const n = outL.length; // 128 today; render-quantum changes stay safe below

    if (!this.ready || !inp || inp.length === 0 || n > QUANTUM) {
      // Wire until the engine exists (or if the quantum ever outgrows us).
      const inL = inp?.[0], inR = inp?.[1] ?? inp?.[0];
      outL.set(inL ?? new Float32Array(n));
      if (outR !== outL) outR.set(inR ?? new Float32Array(n));
      return true;
    }

    const inL = inp[0], inR = inp[1] ?? inp[0];
    this.ioL.set(inL.subarray(0, n));
    this.ioR.set(inR.subarray(0, n));
    this.ex.wd_process(n);
    outL.set(this.ioL.subarray(0, n));
    if (outR !== outL) outR.set(this.ioR.subarray(0, n));

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
