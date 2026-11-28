// wd-plugin-worklet.js — generic 3-output AudioWorkletProcessor wrapping any
// standalone Werewolf Digital DSP .wasm exporting the wd_* C ABI.
//
// Output 0 = processed stereo main (wd_in)
// Output 1 = post-input pre-FX tap (wd_pre)
// Output 2 = auxiliary signal tap (wd_aux: detector / vocal / wet tail)

const MAX_BLOCK = 2048;

function stubImports(module) {
  const imports = {};
  for (const d of WebAssembly.Module.imports(module)) {
    imports[d.module] = imports[d.module] || {};
    imports[d.module][d.name] =
      d.kind === 'function' ? () => 0 : undefined;
  }
  return imports;
}

class WdPluginWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.ready = false;
    this.pending = [];
    this.meterCountdown = 0;
    this.port.onmessage = e => this.handle(e.data);

    const module = options.processorOptions.module;
    WebAssembly.instantiate(module, stubImports(module)).then(instance => {
      this.wasm = instance.exports;
      this.wasm.wd_init(sampleRate);
      this.refreshViews();
      for (const msg of this.pending) this.apply(msg);
      this.pending.length = 0;
      this.ready = true;
      this.port.postMessage({ type: 'ready' });
    });
  }

  refreshViews() {
    if (!this.f32 || this.f32.buffer !== this.wasm.memory.buffer) {
      this.f32 = new Float32Array(this.wasm.memory.buffer);
    }
    this.inL = this.wasm.wd_in(0) >> 2;
    this.inR = this.wasm.wd_in(1) >> 2;
    this.preL = this.wasm.wd_pre(0) >> 2;
    this.preR = this.wasm.wd_pre(1) >> 2;
    this.auxL = this.wasm.wd_aux(0) >> 2;
    this.auxR = this.wasm.wd_aux(1) >> 2;
  }

  handle(msg) {
    if (!this.ready) {
      this.pending.push(msg);
      return;
    }
    this.apply(msg);
  }

  apply(msg) {
    if (!msg) return;
    if (msg.type === 'controls') {
      const vals = msg.values;
      if (vals && vals.length) {
        for (let i = 0; i < vals.length; i++)
          this.wasm.wd_set_param(i, vals[i]);
      }
      this.wasm.wd_apply();
    } else if (msg.type === 'modState') {
      if (Array.isArray(msg.slots)) {
        for (let i = 0; i < msg.slots.length; i++) {
          const s = msg.slots[i];
          if (s) this.wasm.wd_set_mod_slot(i, s.source | 0, s.dest | 0, s.curve | 0, s.on ? 1 : 0);
        }
      }
      if (Array.isArray(msg.xlfos)) {
        for (let x = 0; x < msg.xlfos.length; x++) {
          const xf = msg.xlfos[x];
          if (!xf) continue;
          this.wasm.wd_set_xlfo_cfg(x, xf.numSteps | 0, xf.isSynced ? 1 : 0, Number(xf.syncRateBeats) || 1.0, xf.retriggerMode | 0);
          if (Array.isArray(xf.steps)) {
            for (let k = 0; k < xf.steps.length; k++) {
              const st = xf.steps[k];
              if (st) this.wasm.wd_set_xlfo_step(x, k, Number(st.value) || 0, Number(st.glide) || 0, Number(st.slope) || 0);
            }
          }
        }
      }
      this.wasm.wd_apply();
    } else if (msg.type === 'action') {
      this.wasm.wd_action(msg.actionId | 0, Number(msg.value) || 0);
      this.wasm.wd_apply();
    }
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const out0 = outputs[0];
    const out1 = outputs[1];
    const out2 = outputs[2];
    const n = out0 && out0[0] ? out0[0].length : 0;
    if (n <= 0) return true;

    if (!this.ready || !input || input.length === 0) {
      for (const bus of [out0, out1, out2]) {
        if (!bus) continue;
        for (let ch = 0; ch < bus.length; ch++)
          if (bus[ch]) bus[ch].fill(0);
      }
      return true;
    }

    const inCh0 = input[0];
    const inCh1 = input[1] || input[0];
    const numCh = input.length > 1 ? 2 : 1;

    for (let offset = 0; offset < n; offset += MAX_BLOCK) {
      const chunk = Math.min(MAX_BLOCK, n - offset);
      this.refreshViews();
      const f32 = this.f32;
      f32.set(inCh0.subarray(offset, offset + chunk), this.inL);
      f32.set(inCh1.subarray(offset, offset + chunk), this.inR);

      this.wasm.wd_process(chunk, numCh);

      this.refreshViews();
      const post = this.f32;
      if (out0 && out0[0]) out0[0].set(post.subarray(this.inL, this.inL + chunk), offset);
      if (out0 && out0[1]) out0[1].set(post.subarray(this.inR, this.inR + chunk), offset);
      if (out1 && out1[0]) out1[0].set(post.subarray(this.preL, this.preL + chunk), offset);
      if (out1 && out1[1]) out1[1].set(post.subarray(this.preR, this.preR + chunk), offset);
      if (out2 && out2[0]) out2[0].set(post.subarray(this.auxL, this.auxL + chunk), offset);
      if (out2 && out2[1]) out2[1].set(post.subarray(this.auxR, this.auxR + chunk), offset);
    }

    if (--this.meterCountdown <= 0) {
      this.meterCountdown = 4; // ~10.7 ms at 48 kHz
      this.refreshViews();
      const mCount = this.wasm.wd_meter_count() | 0;
      if (mCount > 0) {
        const mPtr = this.wasm.wd_meter_buf() >> 2;
        const values = Array.from(this.f32.subarray(mPtr, mPtr + mCount));
        this.port.postMessage({ type: 'meters', values });
      }
    }
    return true;
  }
}

registerProcessor('wd-plugin-worklet', WdPluginWorklet);
