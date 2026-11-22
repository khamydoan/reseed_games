/* ForestNet in plain JavaScript (classic script, global RQ.ForestNet). Works from file:// and in Node (vm).
 * A port of reseed/site/js/forestnet.js (ES module) with the same maths: float16 weights decoded to float32,
 * 4 x (conv 3x3 + folded BatchNorm + ReLU) with 2x2 max-pool between them, global average pool,
 * fc 160 -> 96 + ReLU, linear heads, softmax. Weights: data/forestnet-model.js -> window.RQ_FORESTNET = {manifest, b64}.
 *
 *   var net = RQ.ForestNet.load();                      // sync, cached
 *   var r = RQ.ForestNet.forward(net, rgba64x64);       // Uint8 RGBA (4/pixel) or RGB (3/pixel), 64x64
 *   r.pForest, r.forest, r.view, r.label, r.top, r.probs, r.logits, r.acts, r.ms
 *   var px = RQ.ForestNet.imageToRGBA(imgOrCanvas);     // {rgba, canvas}; needs same-origin pixels (http(s), not file://)
 */
(function (root) {
  "use strict";
  var RQ = root.RQ = root.RQ || {};

  function halfToFloat(h) {
    var s = (h & 0x8000) >> 15, e = (h & 0x7c00) >> 10, f = h & 0x03ff;
    if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
    if (e === 0x1f) return f ? NaN : (s ? -Infinity : Infinity);
    return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
  }

  /** base64 -> Uint8Array (browser atob, or Node Buffer). */
  function b64ToBytes(b64) {
    if (typeof root.atob === "function") {
      var bin = root.atob(b64), n = bin.length, out = new Uint8Array(n);
      for (var i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    /* global Buffer */
    var buf = Buffer.from(b64, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  /** manifest + ArrayBuffer of little-endian float16 -> net {manifest, layers{name: {shape, data}}} */
  function buildNet(manifest, buffer) {
    var u16 = new Uint16Array(buffer), layers = {};
    manifest.layers.forEach(function (l) {
      var out = new Float32Array(l.size);
      for (var i = 0; i < l.size; i++) out[i] = halfToFloat(u16[l.offset + i]);
      layers[l.name] = { shape: l.shape, data: out };
    });
    return { manifest: manifest, layers: layers };
  }

  var cached = null;
  /** Build the network from window.RQ_FORESTNET (data/forestnet-model.js). Synchronous; cached. */
  function load(src) {
    if (cached && !src) return cached;
    var m = src || root.RQ_FORESTNET;
    if (!m) throw new Error("ForestNet weights missing: include data/forestnet-model.js");
    var bytes = b64ToBytes(m.b64);
    var ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); // aligned copy
    var net = buildNet(m.manifest, ab);
    if (!src) cached = net;
    return net;
  }

  // 3x3 convolution, stride 1, zero padding 1, + bias, ReLU. Layout: [C][H][W].
  function conv3x3Relu(input, cIn, h, w, weight, bias, cOut) {
    var out = new Float32Array(cOut * h * w);
    for (var co = 0; co < cOut; co++) {
      var o = co * h * w;
      out.fill(bias[co], o, o + h * w);
      for (var ci = 0; ci < cIn; ci++) {
        var inp = ci * h * w, wb = (co * cIn + ci) * 9;
        for (var ky = 0; ky < 3; ky++) {
          for (var kx = 0; kx < 3; kx++) {
            var k = weight[wb + ky * 3 + kx];
            if (k === 0) continue;
            var dy = ky - 1, dx = kx - 1;
            var y0 = Math.max(0, -dy), y1 = Math.min(h, h - dy), x0 = Math.max(0, -dx), x1 = Math.min(w, w - dx);
            for (var y = y0; y < y1; y++) {
              var orow = o + y * w, irow = inp + (y + dy) * w + dx;
              for (var x = x0; x < x1; x++) out[orow + x] += k * input[irow + x];
            }
          }
        }
      }
      for (var i = o; i < o + h * w; i++) if (out[i] < 0) out[i] = 0;
    }
    return out;
  }

  function maxPool2(input, c, h, w) {
    var h2 = h >> 1, w2 = w >> 1, out = new Float32Array(c * h2 * w2);
    for (var ch = 0; ch < c; ch++) {
      for (var y = 0; y < h2; y++) {
        for (var x = 0; x < w2; x++) {
          var i = ch * h * w + 2 * y * w + 2 * x;
          out[ch * h2 * w2 + y * w2 + x] = Math.max(input[i], input[i + 1], input[i + w], input[i + w + 1]);
        }
      }
    }
    return out;
  }

  function linear(x, W, b, outDim, relu) {
    var inDim = x.length, out = new Float32Array(outDim);
    for (var o = 0; o < outDim; o++) {
      var s = b[o], row = o * inDim;
      for (var i = 0; i < inDim; i++) s += W[row + i] * x[i];
      out[o] = relu && s < 0 ? 0 : s;
    }
    return out;
  }

  function softmax(v) {
    var m = -Infinity, i;
    for (i = 0; i < v.length; i++) if (v[i] > m) m = v[i];
    var e = [], s = 0;
    for (i = 0; i < v.length; i++) { e.push(Math.exp(v[i] - m)); s += e[i]; }
    return e.map(function (x) { return x / s; });
  }

  /** Uint8 pixels (RGB stride 3 or RGBA stride 4) of 64x64 -> normalised Float32Array [3][64][64]. */
  function toInput(net, rgbU8, stride) {
    var H = net.manifest.input[1], W = net.manifest.input[2], mean = net.manifest.mean, std = net.manifest.std;
    stride = stride || (rgbU8.length === H * W * 4 ? 4 : 3);
    var x = new Float32Array(3 * H * W);
    for (var i = 0; i < H * W; i++) {
      for (var c = 0; c < 3; c++) x[c * H * W + i] = (rgbU8[i * stride + c] / 255 - mean[c]) / std[c];
    }
    return x;
  }

  /** Raw forward pass on a normalised input. Returns {acts, pooled, hidden, logits, probs}. */
  function forwardRaw(net, x) {
    var layers = net.layers, manifest = net.manifest, channels = manifest.channels;
    var c = manifest.input[0], h = manifest.input[1], w = manifest.input[2], a = x, acts = [];
    for (var i = 0; i < channels.length; i++) {
      var cOut = channels[i];
      a = conv3x3Relu(a, c, h, w, layers["conv" + (i + 1) + ".weight"].data, layers["conv" + (i + 1) + ".bias"].data, cOut);
      c = cOut;
      acts.push({ data: a, c: c, h: h, w: w });
      if (i < channels.length - 1) { a = maxPool2(a, c, h, w); h >>= 1; w >>= 1; }
    }
    var pooled = new Float32Array(c);
    for (var ch = 0; ch < c; ch++) {
      var s = 0;
      for (var j = 0; j < h * w; j++) s += a[ch * h * w + j];
      pooled[ch] = s / (h * w);
    }
    var hidden = linear(pooled, layers["fc.weight"].data, layers["fc.bias"].data, manifest.hidden, true);
    var logits = {}, probs = {};
    Object.keys(manifest.classes).forEach(function (k) {
      var Wt = layers["head_" + k + ".weight"];
      logits[k] = linear(hidden, Wt.data, layers["head_" + k + ".bias"].data, Wt.shape[0], false);
      probs[k] = softmax(logits[k]);
    });
    return { acts: acts, pooled: pooled, hidden: hidden, logits: logits, probs: probs };
  }

  /** Human-readable verdict: same rules as reseed.classify.infer._describe. */
  function describe(net, out) {
    var cls = net.manifest.classes, pv = out.probs.view, vi = 0;
    for (var i = 1; i < pv.length; i++) if (pv[i] > pv[vi]) vi = i;
    var view = cls.view[vi], head = net.manifest.view_heads[view], p = out.probs[head];
    var order = p.map(function (_, k) { return k; }).sort(function (a, b) { return p[b] - p[a]; });
    return {
      forest: out.probs.forest[1] > 0.5, pForest: out.probs.forest[1], view: view, pView: pv[vi],
      label: cls[head][order[0]], pLabel: p[order[0]], head: head,
      top: order.slice(0, 5).map(function (k) { return { label: cls[head][k], p: p[k] }; }),
      landcover: cls.landcover.map(function (name, k) { return { label: name, p: out.probs.landcover[k] }; })
        .sort(function (a, b) { return b.p - a.p; }).slice(0, 3)
    };
  }

  function now() { return root.performance && root.performance.now ? root.performance.now() : Date.now(); }

  /** One picture -> everything: describe() fields + logits, probs, acts, ms. */
  function forward(net, rgba, stride) {
    net = net || load();
    var t0 = now();
    var out = forwardRaw(net, toInput(net, rgba, stride));
    var d = describe(net, out);
    d.logits = out.logits; d.probs = out.probs; d.acts = out.acts; d.hidden = out.hidden; d.pooled = out.pooled;
    d.ms = now() - t0;
    return d;
  }

  /** Browser helper: centre-crop an image/canvas to a square and read it at 64x64 (as in the ReSeed site).
   *  Note: images from file:// taint the canvas; use precomputed pixels offline. */
  function imageToRGBA(source, size) {
    size = size || 64;
    var sw = source.naturalWidth || source.videoWidth || source.width, sh = source.naturalHeight || source.videoHeight || source.height;
    var s = Math.min(sw, sh), src = source, sx = (sw - s) / 2, sy = (sh - s) / 2, ss = s;
    if (s > size * 4) { // two-step downscale keeps it close to PIL's antialiased resize
      var mid = root.document.createElement("canvas");
      mid.width = mid.height = size * 4;
      var mctx = mid.getContext("2d");
      mctx.imageSmoothingQuality = "high";
      mctx.drawImage(source, sx, sy, s, s, 0, 0, size * 4, size * 4);
      src = mid; sx = sy = 0; ss = size * 4;
    }
    var c = root.document.createElement("canvas");
    c.width = c.height = size;
    var ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, sx, sy, ss, ss, 0, 0, size, size);
    return { rgba: ctx.getImageData(0, 0, size, size).data, canvas: c };
  }

  /** Number of weights in the exported (BatchNorm-folded) network. */
  function paramCount(net) {
    return (net || load()).manifest.layers.reduce(function (s, l) { return s + l.size; }, 0);
  }

  RQ.ForestNet = {
    load: load, forward: forward, imageToRGBA: imageToRGBA,
    buildNet: buildNet, toInput: toInput, forwardRaw: forwardRaw, describe: describe, softmax: softmax,
    halfToFloat: halfToFloat, b64ToBytes: b64ToBytes, paramCount: paramCount
  };
})(typeof window !== "undefined" ? window : globalThis);
