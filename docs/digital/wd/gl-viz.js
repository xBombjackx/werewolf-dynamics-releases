// ==========================================================================
// Werewolf Digital — Shared WebGL2 Micro-Renderer (/wd/gl-viz.js)
// Provides:
//  - WDGLViz.isWebGL2Supported(canvas) — strict WebGL2 + shader + FBO check
//  - WDGLViz.createPhosphorScope(canvas, opts) — ping-pong FBO CRT decay
//  - WDGLViz.createSpectrogram(canvas, opts) — zero-copy R8 ring-buffer STFT
// Both primitives automatically fall back to clean Canvas2D rendering when
// WebGL2 is unavailable (e.g. headless jsdom or software renderers).
// ==========================================================================

(function () {
  'use strict';

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function computeResizeDims(w, h, nextDpr) {
    const rw = Number(w);
    const rh = Number(h);
    const logicalW = (Number.isFinite(rw) && rw > 0) ? rw : 0;
    const logicalH = (Number.isFinite(rh) && rh > 0) ? rh : 0;
    const rawDpr = Number(nextDpr);
    const dpr = (Number.isFinite(rawDpr) && rawDpr > 0) ? Math.min(4, Math.max(1, rawDpr)) : 1;
    if (logicalW <= 0 || logicalH <= 0) {
      return { logicalW, logicalH, dpr, pixelW: 0, pixelH: 0 };
    }
    return {
      logicalW,
      logicalH,
      dpr,
      pixelW: Math.max(1, Math.round(logicalW * dpr)),
      pixelH: Math.max(1, Math.round(logicalH * dpr))
    };
  }

  const DEFAULT_WATERFALL_STOPS = [
    { t: 0.00, rgb: [6, 7, 10] },
    { t: 0.04, rgb: [12, 24, 48] },
    { t: 0.30, rgb: [34, 89, 163] },
    { t: 0.60, rgb: [34, 211, 238] },
    { t: 0.84, rgb: [245, 158, 18] },
    { t: 1.00, rgb: [255, 250, 243] }
  ];

  // Parse CSS hex / rgb() / rgba() into normalized [r, g, b, a] once on setup/theme change.
  function parseColorToRgba(cssStr, fallback) {
    const fb = fallback || [0.024, 0.027, 0.039, 1.0];
    if (typeof cssStr !== 'string') return fb.slice();
    const s = cssStr.trim();
    if (!s) return fb.slice();

    if (s[0] === '#') {
      const hex = s.slice(1);
      if (hex.length === 3 || hex.length === 4) {
        const r = parseInt(hex[0] + hex[0], 16) / 255;
        const g = parseInt(hex[1] + hex[1], 16) / 255;
        const b = parseInt(hex[2] + hex[2], 16) / 255;
        const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1.0;
        if (isFinite(r) && isFinite(g) && isFinite(b) && isFinite(a))
          return [r, g, b, a];
      } else if (hex.length === 6 || hex.length === 8) {
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;
        const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1.0;
        if (isFinite(r) && isFinite(g) && isFinite(b) && isFinite(a))
          return [r, g, b, a];
      }
      return fb.slice();
    }

    const m = s.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i);
    if (m) {
      const r = clamp(parseFloat(m[1]) / 255, 0, 1);
      const g = clamp(parseFloat(m[2]) / 255, 0, 1);
      const b = clamp(parseFloat(m[3]) / 255, 0, 1);
      const a = m[4] !== undefined ? clamp(parseFloat(m[4]), 0, 1) : 1.0;
      if (isFinite(r) && isFinite(g) && isFinite(b) && isFinite(a))
        return [r, g, b, a];
    }
    return fb.slice();
  }

  function compileShader(gl, type, src) {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function linkProgram(gl, vsSrc, fsSrc) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      return null;
    }
    const prog = gl.createProgram();
    if (!prog) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return null;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.deleteProgram(prog);
      return null;
    }
    return prog;
  }

  // Strictly validates real WebGL2 capability (never fooled by jsdom Proxies).
  function isWebGL2Supported(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') return false;
    if (typeof window.WebGL2RenderingContext !== 'function') return false;

    let gl = null;
    try {
      gl = canvas.getContext('webgl2', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false
      });
    } catch (_) {
      return false;
    }

    if (!gl || !(gl instanceof window.WebGL2RenderingContext)) return false;
    if (typeof gl.getParameter !== 'function' || !gl.getParameter(gl.VERSION)) return false;
    if (typeof gl.createShader !== 'function'
        || typeof gl.createProgram !== 'function'
        || typeof gl.createFramebuffer !== 'function'
        || typeof gl.texSubImage2D !== 'function') {
      return false;
    }

    let vs = null;
    let fs = null;
    let prog = null;
    let fbo = null;
    let tex = null;
    try {
      vs = compileShader(gl, gl.VERTEX_SHADER,
        '#version 300 es\nin vec2 aPos;\nvoid main(){gl_Position=vec4(aPos,0.0,1.0);}');
      fs = compileShader(gl, gl.FRAGMENT_SHADER,
        '#version 300 es\nprecision mediump float;\nout vec4 oCol;\nvoid main(){oCol=vec4(1.0);}');
      if (!vs || !fs) return false;

      prog = gl.createProgram();
      if (!prog) return false;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;

      tex = gl.createTexture();
      fbo = gl.createFramebuffer();
      if (!tex || !fbo) return false;

      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return status === gl.FRAMEBUFFER_COMPLETE;
    } catch (_) {
      return false;
    } finally {
      try {
        if (fbo) gl.deleteFramebuffer(fbo);
        if (tex) gl.deleteTexture(tex);
        if (prog) gl.deleteProgram(prog);
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
      } catch (_) {}
    }
  }

  function manageOverlayCanvas(canvas, opts) {
    if (opts && opts.overlayCanvas) {
      return { el: opts.overlayCanvas, owned: false, ctx: opts.overlayCanvas.getContext('2d') };
    }
    if (!opts || typeof opts.onOverlayDraw !== 'function' || !canvas.parentElement) {
      return { el: null, owned: false, ctx: null };
    }
    const ov = document.createElement('canvas');
    ov.className = 'wd-gl-overlay';
    ov.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    canvas.parentElement.appendChild(ov);
    return { el: ov, owned: true, ctx: ov.getContext('2d') };
  }

  function buildLutBytes(stops, outBytes) {
    const list = (Array.isArray(stops) && stops.length >= 2) ? stops : DEFAULT_WATERFALL_STOPS;
    for (let i = 0; i < 256; ++i) {
      const t = i / 255;
      let a = list[0];
      let b = list[list.length - 1];
      for (let s = 0; s < list.length - 1; ++s) {
        if (t >= list[s].t && t <= list[s + 1].t) {
          a = list[s];
          b = list[s + 1];
          break;
        }
      }
      if (t <= list[0].t) { a = list[0]; b = list[0]; }
      if (t >= list[list.length - 1].t) { a = list[list.length - 1]; b = list[list.length - 1]; }
      const span = b.t - a.t;
      const u = span > 1e-6 ? clamp((t - a.t) / span, 0, 1) : 0;
      const off = i * 4;
      outBytes[off]     = Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * u);
      outBytes[off + 1] = Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * u);
      outBytes[off + 2] = Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * u);
      outBytes[off + 3] = 255;
    }
  }

  // -------------------------------------------------------------------------
  // 1. CRT Phosphor Scope (Ping-Pong FBO Decay + Additive Energy Glow)
  // -------------------------------------------------------------------------
  function createPhosphorScope(canvas, opts = {}) {
    const mode = opts.mode === 'line' ? 'line' : 'points';
    let decayTauMs = isFinite(opts.decayTauMs) ? Math.max(10, opts.decayTauMs) : 180;
    let pointSize = isFinite(opts.pointSize) ? Math.max(1, opts.pointSize) : 3.5;
    let lineWidth = isFinite(opts.lineWidth) ? Math.max(0.5, opts.lineWidth) : 2.0;
    const squareAspect = opts.squareAspect !== false;

    const palette = {
      bg: parseColorToRgba(opts.bgColor || '#06070a', [0.024, 0.027, 0.039, 1]),
      primary: parseColorToRgba(opts.primaryColor || '#9db5e0', [0.616, 0.710, 0.878, 1]),
      secondary: parseColorToRgba(opts.secondaryColor || '#a78bfa', [0.655, 0.545, 0.980, 1]),
      key: parseColorToRgba(opts.keyColor || '#22d3ee', [0.133, 0.827, 0.933, 1]),
      bgCss: opts.bgColor || '#06070a',
      primaryCss: opts.primaryColor || '#9db5e0',
      secondaryCss: opts.secondaryColor || '#a78bfa',
      keyCss: opts.keyColor || '#22d3ee'
    };

    let logicalW = 0;
    let logicalH = 0;
    let dpr = 1;
    let pixelW = 0;
    let pixelH = 0;
    let destroyed = false;

    const useGL = isWebGL2Supported(canvas);
    const overlay = useGL ? manageOverlayCanvas(canvas, opts) : { el: null, owned: false, ctx: null };

    function redrawOverlay() {
      if (typeof opts.onOverlayDraw !== 'function') return;
      if (logicalW <= 0 || logicalH <= 0) return;
      if (overlay.ctx) {
        if (overlay.el) {
          overlay.el.width = pixelW;
          overlay.el.height = pixelH;
        }
        overlay.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        overlay.ctx.clearRect(0, 0, logicalW, logicalH);
        opts.onOverlayDraw(overlay.ctx, logicalW, logicalH, dpr);
      }
    }

    function setColors(colors) {
      if (!colors || typeof colors !== 'object') return;
      if (colors.bgColor) {
        palette.bgCss = colors.bgColor;
        palette.bg = parseColorToRgba(colors.bgColor, palette.bg);
      }
      if (colors.primaryColor) {
        palette.primaryCss = colors.primaryColor;
        palette.primary = parseColorToRgba(colors.primaryColor, palette.primary);
      }
      if (colors.secondaryColor) {
        palette.secondaryCss = colors.secondaryColor;
        palette.secondary = parseColorToRgba(colors.secondaryColor, palette.secondary);
      }
      if (colors.keyColor) {
        palette.keyCss = colors.keyColor;
        palette.key = parseColorToRgba(colors.keyColor, palette.key);
      }
      if (isFinite(colors.decayTauMs)) decayTauMs = Math.max(10, colors.decayTauMs);
      if (isFinite(colors.pointSize)) pointSize = Math.max(1, colors.pointSize);
      if (isFinite(colors.lineWidth)) lineWidth = Math.max(0.5, colors.lineWidth);
      redrawOverlay();
    }

    // ---- Canvas2D Fallback Path ---------------------------------------------
    if (!useGL) {
      const ctx2d = canvas.getContext('2d');
      let lastFrame = null;

      function drawDefault2D(data) {
        if (!ctx2d || logicalW <= 0 || logicalH <= 0) return;
        ctx2d.clearRect(0, 0, logicalW, logicalH);
        if (typeof opts.onOverlayDraw === 'function')
          opts.onOverlayDraw(ctx2d, logicalW, logicalH, dpr);

        if (!data) return;
        if (mode === 'points') {
          const pts = data.points || data;
          const len = data.count !== undefined ? Math.min(pts.length, data.count * 2) : pts.length;
          if (!pts || len < 2) return;
          const cx = logicalW * 0.5;
          const cy = logicalH * 0.5;
          const r = Math.min(cx, cy) * 0.88;
          ctx2d.fillStyle = palette.primaryCss;
          for (let i = 0; i + 1 < len; i += 2) {
            const x = cx - pts[i + 1] * r;
            const y = cy - pts[i] * r;
            ctx2d.fillRect(x - 1, y - 1, 2, 2);
          }
        } else {
          const drawTrace = (arr, color, scaleY) => {
            if (!arr || arr.length < 2) return;
            ctx2d.strokeStyle = color;
            ctx2d.lineWidth = lineWidth;
            ctx2d.beginPath();
            for (let i = 0; i < arr.length; ++i) {
              const x = (i / (arr.length - 1)) * logicalW;
              const y = logicalH * 0.5 - arr[i] * scaleY;
              if (i === 0) ctx2d.moveTo(x, y);
              else ctx2d.lineTo(x, y);
            }
            ctx2d.stroke();
          };
          const sy = (data.scaleY !== undefined ? data.scaleY : (logicalH * 0.4));
          if (Array.isArray(data.traces)) {
            for (let t = 0; t < data.traces.length; ++t) {
              const tr = data.traces[t];
              if (tr && tr.data) drawTrace(tr.data, tr.color || palette.primaryCss, tr.scaleY ?? sy);
            }
          } else if (data.mid || data.side || data.sc) {
            if (data.sc) drawTrace(data.sc, palette.keyCss, sy);
            if (data.side) drawTrace(data.side, palette.secondaryCss, sy);
            if (data.mid) drawTrace(data.mid, palette.primaryCss, sy);
          } else if (data.length) {
            drawTrace(data, palette.primaryCss, sy);
          }
        }
      }

      return {
        resize(w, h, nextDpr = 1) {
          if (destroyed) return;
          const dims = computeResizeDims(w, h, nextDpr);
          logicalW = dims.logicalW;
          logicalH = dims.logicalH;
          dpr = dims.dpr;
          pixelW = dims.pixelW;
          pixelH = dims.pixelH;
          if (pixelW > 0 && pixelH > 0) {
            canvas.width = pixelW;
            canvas.height = pixelH;
            if (ctx2d) ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
            if (typeof opts.onFallbackDraw === 'function')
              opts.onFallbackDraw(ctx2d, logicalW, logicalH, lastFrame, palette);
            else
              drawDefault2D(lastFrame);
          }
        },
        pushFrame(data) {
          if (destroyed) return;
          lastFrame = data;
          if (pixelW <= 0 || pixelH <= 0 || !ctx2d) return;
          if (typeof opts.onFallbackDraw === 'function')
            opts.onFallbackDraw(ctx2d, logicalW, logicalH, data, palette);
          else
            drawDefault2D(data);
        },
        clear() {
          if (destroyed) return;
          lastFrame = null;
          if (ctx2d && pixelW > 0 && pixelH > 0) {
            ctx2d.clearRect(0, 0, logicalW, logicalH);
            if (typeof opts.onOverlayDraw === 'function')
              opts.onOverlayDraw(ctx2d, logicalW, logicalH, dpr);
          }
        },
        setColors(c) {
          if (destroyed) return;
          setColors(c);
          if (ctx2d && pixelW > 0 && pixelH > 0) {
            if (typeof opts.onFallbackDraw === 'function')
              opts.onFallbackDraw(ctx2d, logicalW, logicalH, lastFrame, palette);
            else
              drawDefault2D(lastFrame);
          }
        },
        isWebGL2() { return false; },
        destroy() {
          destroyed = true;
          lastFrame = null;
        }
      };
    }

    // ---- WebGL2 Ping-Pong FBO Path -----------------------------------------
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });

    let contextLost = false;
    let glReady = false;
    let hasFloatFbo = false;
    let decayProg = null;
    let pointProg = null;
    let traceProg = null;
    let lineProg = null;
    let compositeProg = null;
    let quadVao = null;
    let quadVbo = null;
    let dynVao = null;
    let dynVbo = null;
    let fbo = [null, null];
    let tex = [null, null];
    let pingIdx = 0;
    let fboW = 0;
    let fboH = 0;

    // Preallocated VBO staging buffer (zero per-frame allocations in steady state).
    let vboBuf = new Float32Array(8192);
    let vboCapacityFloats = vboBuf.length;

    const uLoc = {
      decay: {},
      point: {},
      trace: {},
      line: {},
      comp: {}
    };

    function ensureScratchFloats(needed) {
      if (needed <= vboCapacityFloats) return;
      let nextCap = vboCapacityFloats;
      while (nextCap < needed) nextCap *= 2;
      vboBuf = new Float32Array(nextCap);
      vboCapacityFloats = nextCap;
    }

    function initGLResources() {
      hasFloatFbo = !!gl.getExtension('EXT_color_buffer_float');

      const quadVS = `#version 300 es
        in vec2 aPos;
        out vec2 vUv;
        void main() {
          vUv = aPos * 0.5 + 0.5;
          gl_Position = vec4(aPos, 0.0, 1.0);
        }`;

      const decayFS = `#version 300 es
        precision highp float;
        in vec2 vUv;
        uniform sampler2D uSrcTex;
        uniform float uDecay;
        uniform float uFloor;
        out vec4 oCol;
        void main() {
          vec4 c = texture(uSrcTex, vUv) * uDecay - vec4(uFloor);
          oCol = max(vec4(0.0), c);
        }`;

      const pointVS = `#version 300 es
        in vec2 aPos;
        uniform float uPointSize;
        void main() {
          gl_Position = vec4(aPos, 0.0, 1.0);
          gl_PointSize = uPointSize;
        }`;

      const pointFS = `#version 300 es
        precision highp float;
        uniform vec4 uColor;
        uniform float uIntensity;
        out vec4 oCol;
        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float d2 = dot(p, p);
          if (d2 > 1.0) discard;
          float w = exp(-4.5 * d2) * uIntensity;
          oCol = vec4(uColor.rgb * w, w);
        }`;

      const traceVS = `#version 300 es
        in vec2 aPos;
        void main() {
          gl_Position = vec4(aPos, 0.0, 1.0);
        }`;

      const traceFS = `#version 300 es
        precision highp float;
        uniform vec4 uColor;
        uniform float uIntensity;
        out vec4 oCol;
        void main() {
          float w = uIntensity;
          oCol = vec4(uColor.rgb * w, w);
        }`;

      const lineVS = `#version 300 es
        in vec3 aPosEdge;
        out float vEdge;
        void main() {
          vEdge = aPosEdge.z;
          gl_Position = vec4(aPosEdge.xy, 0.0, 1.0);
        }`;

      const lineFS = `#version 300 es
        precision highp float;
        in float vEdge;
        uniform vec4 uColor;
        uniform float uIntensity;
        out vec4 oCol;
        void main() {
          float w = exp(-3.2 * vEdge * vEdge) * uIntensity;
          oCol = vec4(uColor.rgb * w, w);
        }`;

      const compFS = `#version 300 es
        precision highp float;
        in vec2 vUv;
        uniform sampler2D uSrcTex;
        uniform vec2 uTexelSize;
        uniform vec4 uBgColor;
        out vec4 oCol;
        void main() {
          vec3 core = texture(uSrcTex, vUv).rgb;
          vec3 halo = (
            texture(uSrcTex, vUv + vec2(uTexelSize.x, 0.0)).rgb +
            texture(uSrcTex, vUv - vec2(uTexelSize.x, 0.0)).rgb +
            texture(uSrcTex, vUv + vec2(0.0, uTexelSize.y)).rgb +
            texture(uSrcTex, vUv - vec2(0.0, uTexelSize.y)).rgb
          ) * 0.25;
          vec3 energy = core + halo * 0.32;
          vec3 mapped = 1.0 - exp(-energy * 1.2);
          vec3 rgb = uBgColor.rgb + mapped * (vec3(1.0) - uBgColor.rgb * 0.65);
          oCol = vec4(clamp(rgb, 0.0, 1.0), 1.0);
        }`;

      decayProg = linkProgram(gl, quadVS, decayFS);
      pointProg = linkProgram(gl, pointVS, pointFS);
      traceProg = linkProgram(gl, traceVS, traceFS);
      lineProg = linkProgram(gl, lineVS, lineFS);
      compositeProg = linkProgram(gl, quadVS, compFS);

      if (!decayProg || !pointProg || !traceProg || !lineProg || !compositeProg) {
        [decayProg, pointProg, traceProg, lineProg, compositeProg].forEach(p => { if (p) gl.deleteProgram(p); });
        decayProg = pointProg = traceProg = lineProg = compositeProg = null;
        glReady = false;
        return false;
      }

      uLoc.decay.src = gl.getUniformLocation(decayProg, 'uSrcTex');
      uLoc.decay.decay = gl.getUniformLocation(decayProg, 'uDecay');
      uLoc.decay.floor = gl.getUniformLocation(decayProg, 'uFloor');

      uLoc.point.size = gl.getUniformLocation(pointProg, 'uPointSize');
      uLoc.point.color = gl.getUniformLocation(pointProg, 'uColor');
      uLoc.point.intensity = gl.getUniformLocation(pointProg, 'uIntensity');

      uLoc.trace.color = gl.getUniformLocation(traceProg, 'uColor');
      uLoc.trace.intensity = gl.getUniformLocation(traceProg, 'uIntensity');

      uLoc.line.color = gl.getUniformLocation(lineProg, 'uColor');
      uLoc.line.intensity = gl.getUniformLocation(lineProg, 'uIntensity');

      uLoc.comp.src = gl.getUniformLocation(compositeProg, 'uSrcTex');
      uLoc.comp.texel = gl.getUniformLocation(compositeProg, 'uTexelSize');
      uLoc.comp.bg = gl.getUniformLocation(compositeProg, 'uBgColor');

      quadVao = gl.createVertexArray();
      quadVbo = gl.createBuffer();
      gl.bindVertexArray(quadVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      dynVao = gl.createVertexArray();
      dynVbo = gl.createBuffer();
      gl.bindVertexArray(dynVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, dynVbo);
      gl.bufferData(gl.ARRAY_BUFFER, vboBuf.byteLength, gl.DYNAMIC_DRAW);
      gl.bindVertexArray(null);

      fboW = 0;
      fboH = 0;
      glReady = true;
      return true;
    }

    function ensureFbos(pw, ph) {
      if (!glReady || pw <= 0 || ph <= 0) return false;
      if (fboW === pw && fboH === ph && fbo[0] && fbo[1]) return true;

      for (let i = 0; i < 2; ++i) {
        if (fbo[i]) gl.deleteFramebuffer(fbo[i]);
        if (tex[i]) gl.deleteTexture(tex[i]);
        tex[i] = gl.createTexture();
        fbo[i] = gl.createFramebuffer();
        gl.bindTexture(gl.TEXTURE_2D, tex[i]);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (hasFloatFbo) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, pw, ph, 0, gl.RGBA, gl.HALF_FLOAT, null);
        } else {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, pw, ph, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[i]);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex[i], 0);
        gl.viewport(0, 0, pw, ph);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      fboW = pw;
      fboH = ph;
      pingIdx = 0;
      return true;
    }

    function uploadVbo(floatCount) {
      gl.bindBuffer(gl.ARRAY_BUFFER, dynVbo);
      gl.bufferData(gl.ARRAY_BUFFER, vboBuf.subarray(0, floatCount), gl.DYNAMIC_DRAW);
    }

    function injectPolyline(arr, colorRgba, scaleY, widthPx, intensity) {
      if (!arr || arr.length < 2 || pixelW <= 0 || pixelH <= 0) return;
      const n = arr.length;
      const segs = n - 1;
      const neededFloats = segs * 6 * 3;
      ensureScratchFloats(neededFloats);

      const halfWClipX = (widthPx * dpr) / pixelW;
      const halfWClipY = (widthPx * dpr) / pixelH;
      const normY = (scaleY * 2.0) / Math.max(1, logicalH);

      let ptr = 0;
      for (let i = 0; i < segs; ++i) {
        const x0 = (i / segs) * 2.0 - 1.0;
        const y0 = arr[i] * normY;
        const x1 = ((i + 1) / segs) * 2.0 - 1.0;
        const y1 = arr[i + 1] * normY;

        const dx = (x1 - x0) * pixelW;
        const dy = (y1 - y0) * pixelH;
        const len = Math.hypot(dx, dy) || 1.0;
        const nx = (-dy / len) * halfWClipX;
        const ny = (dx / len) * halfWClipY;

        // Triangle 1: (0+, 0-, 1+)
        vboBuf[ptr++] = x0 + nx; vboBuf[ptr++] = y0 + ny; vboBuf[ptr++] = 1.0;
        vboBuf[ptr++] = x0 - nx; vboBuf[ptr++] = y0 - ny; vboBuf[ptr++] = -1.0;
        vboBuf[ptr++] = x1 + nx; vboBuf[ptr++] = y1 + ny; vboBuf[ptr++] = 1.0;
        // Triangle 2: (0-, 1-, 1+)
        vboBuf[ptr++] = x0 - nx; vboBuf[ptr++] = y0 - ny; vboBuf[ptr++] = -1.0;
        vboBuf[ptr++] = x1 - nx; vboBuf[ptr++] = y1 - ny; vboBuf[ptr++] = -1.0;
        vboBuf[ptr++] = x1 + nx; vboBuf[ptr++] = y1 + ny; vboBuf[ptr++] = 1.0;
      }

      gl.useProgram(lineProg);
      gl.uniform4fv(uLoc.line.color, colorRgba);
      gl.uniform1f(uLoc.line.intensity, intensity);
      gl.bindVertexArray(dynVao);
      uploadVbo(ptr);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, segs * 6);
    }

    function compositeToScreen(srcTex) {
      if (!glReady || !compositeProg) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, pixelW, pixelH);
      gl.disable(gl.BLEND);
      gl.useProgram(compositeProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform1i(uLoc.comp.src, 0);
      gl.uniform2f(uLoc.comp.texel, 1.5 / pixelW, 1.5 / pixelH);
      gl.uniform4fv(uLoc.comp.bg, palette.bg);
      gl.bindVertexArray(quadVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    }

    const onContextLost = e => {
      e.preventDefault();
      contextLost = true;
    };
    const onContextRestored = () => {
      if (destroyed) return;
      contextLost = false;
      if (initGLResources() && pixelW > 0 && pixelH > 0) ensureFbos(pixelW, pixelH);
      redrawOverlay();
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    initGLResources();

    return {
      resize(w, h, nextDpr = 1) {
        if (destroyed) return;
        const dims = computeResizeDims(w, h, nextDpr);
        logicalW = dims.logicalW;
        logicalH = dims.logicalH;
        dpr = dims.dpr;
        pixelW = dims.pixelW;
        pixelH = dims.pixelH;
        if (pixelW > 0 && pixelH > 0) {
          canvas.width = pixelW;
          canvas.height = pixelH;
          if (!contextLost) ensureFbos(pixelW, pixelH);
          redrawOverlay();
        }
      },

      pushFrame(data, dtMs = 16.67) {
        if (destroyed || contextLost || !glReady || pixelW <= 0 || pixelH <= 0) return;
        if (!ensureFbos(pixelW, pixelH)) return;

        const srcIdx = pingIdx;
        const dstIdx = 1 - pingIdx;
        const dt = clamp(isFinite(dtMs) ? dtMs : 16.67, 0.5, 250.0);
        const decay = Math.exp(-dt / decayTauMs);

        // Pass 1: Decay previous phosphor persistence into dst FBO
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[dstIdx]);
        gl.viewport(0, 0, fboW, fboH);
        gl.disable(gl.BLEND);
        gl.useProgram(decayProg);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex[srcIdx]);
        gl.uniform1i(uLoc.decay.src, 0);
        gl.uniform1f(uLoc.decay.decay, decay);
        gl.uniform1f(uLoc.decay.floor, hasFloatFbo ? 0.0 : 0.004);
        gl.bindVertexArray(quadVao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Pass 2: Inject new signal energy additively
        if (data) {
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.ONE, gl.ONE);
          if (mode === 'points') {
            const pts = data.points || data;
            const len = data.count !== undefined ? Math.min(pts.length, data.count * 2) : pts.length;
            const numPts = Math.floor(len / 2);
            if (pts && numPts > 0) {
              ensureScratchFloats(numPts * 2);
              const minDim = Math.min(logicalW, logicalH);
              const sx = squareAspect ? (minDim / Math.max(1, logicalW)) * 0.88 : 0.88;
              const sy = squareAspect ? (minDim / Math.max(1, logicalH)) * 0.88 : 0.88;
              let ptr = 0;
              for (let i = 0; i < numPts * 2; i += 2) {
                vboBuf[ptr++] = -pts[i + 1] * sx;
                vboBuf[ptr++] = pts[i] * sy;
              }
              gl.useProgram(pointProg);
              gl.uniform1f(uLoc.point.size, pointSize * dpr);
              gl.uniform4fv(uLoc.point.color, palette.primary);
              gl.uniform1f(uLoc.point.intensity, isFinite(data.intensity) ? data.intensity : 0.42);
              gl.bindVertexArray(dynVao);
              uploadVbo(ptr);
              gl.enableVertexAttribArray(0);
              gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
              gl.drawArrays(gl.POINTS, 0, numPts);
              if (numPts > 1 && traceProg) {
                gl.useProgram(traceProg);
                gl.uniform4fv(uLoc.trace.color, palette.primary);
                gl.uniform1f(uLoc.trace.intensity, 0.14);
                gl.drawArrays(gl.LINE_STRIP, 0, numPts);
              }
            }
          } else {
            const sy = data.scaleY !== undefined ? data.scaleY : (logicalH * 0.4);
            if (Array.isArray(data.traces)) {
              for (let t = 0; t < data.traces.length; ++t) {
                const tr = data.traces[t];
                if (!tr || !tr.data) continue;
                const col = tr.color ? parseColorToRgba(tr.color, palette.primary) : palette.primary;
                injectPolyline(tr.data, col, tr.scaleY ?? sy, tr.lineWidth ?? lineWidth, tr.intensity ?? 0.65);
              }
            } else if (data.mid || data.side || data.sc) {
              if (data.sc) injectPolyline(data.sc, palette.key, sy, lineWidth * 0.85, 0.50);
              if (data.side) injectPolyline(data.side, palette.secondary, sy, lineWidth * 0.9, 0.55);
              if (data.mid) injectPolyline(data.mid, palette.primary, sy, lineWidth, 0.72);
            } else if (data.length) {
              injectPolyline(data, palette.primary, sy, lineWidth, 0.72);
            }
          }
        }

        // Pass 3: Composite persistence buffer onto screen
        compositeToScreen(tex[dstIdx]);
        pingIdx = dstIdx;
      },

      clear() {
        if (destroyed || contextLost || !glReady) return;
        for (let i = 0; i < 2; ++i) {
          if (fbo[i]) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[i]);
            gl.viewport(0, 0, fboW, fboH);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
          }
        }
        if (pixelW > 0 && pixelH > 0 && tex[pingIdx])
          compositeToScreen(tex[pingIdx]);
      },

      setColors(c) {
        if (destroyed) return;
        setColors(c);
        if (glReady && !contextLost && pixelW > 0 && pixelH > 0 && tex[pingIdx])
          compositeToScreen(tex[pingIdx]);
      },

      isWebGL2() { return true; },

      destroy() {
        if (destroyed) return;
        destroyed = true;
        canvas.removeEventListener('webglcontextlost', onContextLost);
        canvas.removeEventListener('webglcontextrestored', onContextRestored);
        if (overlay.owned && overlay.el && overlay.el.parentElement)
          overlay.el.parentElement.removeChild(overlay.el);
        try {
          for (let i = 0; i < 2; ++i) {
            if (fbo[i]) gl.deleteFramebuffer(fbo[i]);
            if (tex[i]) gl.deleteTexture(tex[i]);
          }
          if (quadVao) gl.deleteVertexArray(quadVao);
          if (quadVbo) gl.deleteBuffer(quadVbo);
          if (dynVao) gl.deleteVertexArray(dynVao);
          if (dynVbo) gl.deleteBuffer(dynVbo);
          if (decayProg) gl.deleteProgram(decayProg);
          if (pointProg) gl.deleteProgram(pointProg);
          if (traceProg) gl.deleteProgram(traceProg);
          if (lineProg) gl.deleteProgram(lineProg);
          if (compositeProg) gl.deleteProgram(compositeProg);
        } catch (_) {}
      }
    };
  }

  // -------------------------------------------------------------------------
  // 2. Zero-Copy Ring-Buffer STFT Spectrogram (R8 + texSubImage2D + LUT)
  // -------------------------------------------------------------------------
  function createSpectrogram(canvas, opts = {}) {
    const bins = Math.max(8, Math.round(opts.bins || 240));
    const historyRows = Math.max(8, Math.round(opts.historyRows || 256));
    let dbMin = isFinite(opts.dbMin) ? opts.dbMin : -78;
    let dbMax = isFinite(opts.dbMax) ? opts.dbMax : -6;
    const axisBottomPx = isFinite(opts.axisBottomPx) ? Math.max(0, opts.axisBottomPx) : 0;

    let bgRgba = parseColorToRgba(opts.bgColor || '#06070a', [0.024, 0.027, 0.039, 1]);
    let bgCss = opts.bgColor || '#06070a';
    let lutStops = opts.lutStops || DEFAULT_WATERFALL_STOPS;

    const rowScratch = new Uint8Array(bins);
    const lutBytes = new Uint8Array(256 * 4);
    buildLutBytes(lutStops, lutBytes);

    let logicalW = 0;
    let logicalH = 0;
    let dpr = 1;
    let pixelW = 0;
    let pixelH = 0;
    let writeRow = 0;
    let destroyed = false;

    const useGL = isWebGL2Supported(canvas);
    const overlay = useGL ? manageOverlayCanvas(canvas, opts) : { el: null, owned: false, ctx: null };

    function redrawOverlay() {
      if (typeof opts.onOverlayDraw !== 'function') return;
      if (logicalW <= 0 || logicalH <= 0) return;
      if (overlay.ctx) {
        if (overlay.el) {
          overlay.el.width = pixelW;
          overlay.el.height = pixelH;
        }
        overlay.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        overlay.ctx.clearRect(0, 0, logicalW, logicalH);
        opts.onOverlayDraw(overlay.ctx, logicalW, logicalH, dpr);
      }
    }

    // ---- Canvas2D Fallback Path ---------------------------------------------
    if (!useGL) {
      const ctx2d = canvas.getContext('2d');
      const offCv = document.createElement('canvas');
      offCv.width = bins;
      offCv.height = historyRows;
      const offCtx = offCv.getContext('2d');
      const rowImg = (offCtx && typeof offCtx.createImageData === 'function')
        ? offCtx.createImageData(bins, 1)
        : { data: new Uint8ClampedArray(bins * 4) };

      if (offCtx && typeof offCtx.fillRect === 'function') {
        offCtx.fillStyle = bgCss;
        offCtx.fillRect(0, 0, bins, historyRows);
      }

      function render2D() {
        if (!ctx2d || logicalW <= 0 || logicalH <= 0) return;
        const plotH = Math.max(1, logicalH - axisBottomPx);
        ctx2d.fillStyle = bgCss;
        ctx2d.fillRect(0, 0, logicalW, logicalH);
        if (typeof opts.onFallbackDraw === 'function') {
          opts.onFallbackDraw(ctx2d, logicalW, logicalH, offCv, lutBytes);
        } else if (typeof ctx2d.drawImage === 'function') {
          ctx2d.drawImage(offCv, 0, 0, bins, historyRows, 0, 0, logicalW, plotH);
        }
        if (typeof opts.onOverlayDraw === 'function')
          opts.onOverlayDraw(ctx2d, logicalW, logicalH, dpr);
      }

      return {
        resize(w, h, nextDpr = 1) {
          if (destroyed) return;
          const dims = computeResizeDims(w, h, nextDpr);
          logicalW = dims.logicalW;
          logicalH = dims.logicalH;
          dpr = dims.dpr;
          pixelW = dims.pixelW;
          pixelH = dims.pixelH;
          if (pixelW > 0 && pixelH > 0) {
            canvas.width = pixelW;
            canvas.height = pixelH;
            if (ctx2d) ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
            render2D();
          }
        },
        pushRow(binsData) {
          if (destroyed || !binsData || binsData.length < bins) return;
          const span = Math.max(1e-3, dbMax - dbMin);
          for (let b = 0; b < bins; ++b) {
            const idx = Math.round(clamp((binsData[b] - dbMin) / span, 0, 1) * 255);
            const lo = idx * 4;
            const ro = b * 4;
            rowImg.data[ro]     = lutBytes[lo];
            rowImg.data[ro + 1] = lutBytes[lo + 1];
            rowImg.data[ro + 2] = lutBytes[lo + 2];
            rowImg.data[ro + 3] = 255;
          }
          if (offCtx && typeof offCtx.drawImage === 'function') {
            offCtx.drawImage(offCv, 0, 0, bins, historyRows - 1, 0, 1, bins, historyRows - 1);
            if (typeof offCtx.putImageData === 'function')
              offCtx.putImageData(rowImg, 0, 0);
          }
        },
        render() {
          if (!destroyed) render2D();
        },
        clear() {
          if (destroyed) return;
          if (offCtx && typeof offCtx.fillRect === 'function') {
            offCtx.fillStyle = bgCss;
            offCtx.fillRect(0, 0, bins, historyRows);
          }
          render2D();
        },
        setPalette(stops, nextBg) {
          if (destroyed) return;
          if (Array.isArray(stops) && stops.length >= 2) {
            lutStops = stops;
            buildLutBytes(lutStops, lutBytes);
          }
          if (nextBg) {
            bgCss = nextBg;
            bgRgba = parseColorToRgba(nextBg, bgRgba);
          }
          render2D();
        },
        setRange(nextMin, nextMax) {
          if (destroyed) return;
          if (isFinite(nextMin)) dbMin = nextMin;
          if (isFinite(nextMax)) dbMax = nextMax;
        },
        isWebGL2() { return false; },
        destroy() { destroyed = true; }
      };
    }

    // ---- WebGL2 Ring-Buffer R8 Texture Path --------------------------------
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });

    let contextLost = false;
    let specProg = null;
    let quadVao = null;
    let quadVbo = null;
    let dataTex = null;
    let lutTex = null;
    let uDataLoc = null;
    let uLutLoc = null;
    let uWriteRowLoc = null;
    let uHistRowsLoc = null;
    let zeroTable = null;

    function uploadLut() {
      if (destroyed || !lutTex || contextLost) return;
      gl.bindTexture(gl.TEXTURE_2D, lutTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lutBytes);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    function initGLResources() {
      const vsSrc = `#version 300 es
        in vec2 aPos;
        out vec2 vTex;
        void main() {
          vTex = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
          gl_Position = vec4(aPos, 0.0, 1.0);
        }`;

      const fsSrc = `#version 300 es
        precision highp float;
        in vec2 vTex;
        uniform sampler2D uDataTex;
        uniform sampler2D uLutTex;
        uniform int uWriteRow;
        uniform int uHistoryRows;
        out vec4 oCol;
        void main() {
          float hist = float(uHistoryRows);
          float newestCenter = (float(uWriteRow) - 0.5) / hist;
          float rowV = fract(newestCenter - vTex.y * ((hist - 1.0) / hist));
          float normAmp = texture(uDataTex, vec2(vTex.x, rowV)).r;
          oCol = texture(uLutTex, vec2(normAmp, 0.5));
        }`;

      specProg = linkProgram(gl, vsSrc, fsSrc);
      if (!specProg) {
        glReady = false;
        return false;
      }
      uDataLoc = gl.getUniformLocation(specProg, 'uDataTex');
      uLutLoc = gl.getUniformLocation(specProg, 'uLutTex');
      uWriteRowLoc = gl.getUniformLocation(specProg, 'uWriteRow');
      uHistRowsLoc = gl.getUniformLocation(specProg, 'uHistoryRows');

      quadVao = gl.createVertexArray();
      quadVbo = gl.createBuffer();
      gl.bindVertexArray(quadVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      dataTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, dataTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      if (!zeroTable) zeroTable = new Uint8Array(bins * historyRows);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, bins, historyRows, 0, gl.RED, gl.UNSIGNED_BYTE, zeroTable);

      lutTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, lutTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      uploadLut();
      glReady = true;
      return true;
    }

    const onContextLost = e => {
      e.preventDefault();
      contextLost = true;
    };
    const onContextRestored = () => {
      if (destroyed) return;
      contextLost = false;
      writeRow = 0;
      initGLResources();
      redrawOverlay();
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    let glReady = false;
    initGLResources();

    function drawGL() {
      if (destroyed || contextLost || !glReady || !specProg || pixelW <= 0 || pixelH <= 0) return;
      const axisPx = Math.round(axisBottomPx * dpr);
      const plotPxH = Math.max(1, pixelH - axisPx);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, pixelW, pixelH);
      gl.clearColor(bgRgba[0], bgRgba[1], bgRgba[2], bgRgba[3]);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.viewport(0, axisPx, pixelW, plotPxH);
      gl.useProgram(specProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, dataTex);
      gl.uniform1i(uDataLoc, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, lutTex);
      gl.uniform1i(uLutLoc, 1);
      gl.uniform1i(uWriteRowLoc, writeRow);
      gl.uniform1i(uHistRowsLoc, historyRows);

      gl.bindVertexArray(quadVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    }

    return {
      resize(w, h, nextDpr = 1) {
        if (destroyed) return;
        const dims = computeResizeDims(w, h, nextDpr);
        logicalW = dims.logicalW;
        logicalH = dims.logicalH;
        dpr = dims.dpr;
        pixelW = dims.pixelW;
        pixelH = dims.pixelH;
        if (pixelW > 0 && pixelH > 0) {
          canvas.width = pixelW;
          canvas.height = pixelH;
          redrawOverlay();
          drawGL();
        }
      },

      pushRow(binsData) {
        if (destroyed || contextLost || !glReady || !dataTex || !binsData || binsData.length < bins) return;
        const span = Math.max(1e-3, dbMax - dbMin);
        const invSpan = 255.0 / span;
        for (let b = 0; b < bins; ++b) {
          const val = (binsData[b] - dbMin) * invSpan;
          rowScratch[b] = val <= 0 ? 0 : val >= 255 ? 255 : (val + 0.5) | 0;
        }
        gl.bindTexture(gl.TEXTURE_2D, dataTex);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, writeRow, bins, 1, gl.RED, gl.UNSIGNED_BYTE, rowScratch);
        writeRow = (writeRow + 1) % historyRows;
      },

      render() {
        drawGL();
      },

      clear() {
        if (destroyed || contextLost || !glReady || !dataTex) return;
        writeRow = 0;
        if (!zeroTable) zeroTable = new Uint8Array(bins * historyRows);
        gl.bindTexture(gl.TEXTURE_2D, dataTex);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, bins, historyRows, gl.RED, gl.UNSIGNED_BYTE, zeroTable);
        drawGL();
      },

      setPalette(stops, nextBg) {
        if (destroyed) return;
        if (Array.isArray(stops) && stops.length >= 2) {
          lutStops = stops;
          buildLutBytes(lutStops, lutBytes);
          if (glReady && lutTex) uploadLut();
        }
        if (nextBg) {
          bgCss = nextBg;
          bgRgba = parseColorToRgba(nextBg, bgRgba);
        }
        redrawOverlay();
        drawGL();
      },

      setRange(nextMin, nextMax) {
        if (destroyed) return;
        if (isFinite(nextMin)) dbMin = nextMin;
        if (isFinite(nextMax)) dbMax = nextMax;
      },

      isWebGL2() { return true; },

      destroy() {
        if (destroyed) return;
        destroyed = true;
        canvas.removeEventListener('webglcontextlost', onContextLost);
        canvas.removeEventListener('webglcontextrestored', onContextRestored);
        if (overlay.owned && overlay.el && overlay.el.parentElement)
          overlay.el.parentElement.removeChild(overlay.el);
        try {
          if (dataTex) gl.deleteTexture(dataTex);
          if (lutTex) gl.deleteTexture(lutTex);
          if (quadVao) gl.deleteVertexArray(quadVao);
          if (quadVbo) gl.deleteBuffer(quadVbo);
          if (specProg) gl.deleteProgram(specProg);
        } catch (_) {}
      }
    };
  }

  window.WDGLViz = {
    isWebGL2Supported,
    createPhosphorScope,
    createSpectrogram
  };
})();
