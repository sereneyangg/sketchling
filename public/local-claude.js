// Local stand-in for the claude.ai artifact runtime.
// Provides window.claude.use("sample") backed by the local server (/api/claude),
// so the same page code works both as a published artifact and on your machine.
(() => {
  const MAX_SIDE = 1568; // Claude's recommended max image edge

  function fail(code, message, text) {
    const e = { code, message: message || code };
    if (text != null) e.text = text;
    return e;
  }

  // Downscale and re-encode each image so uploads stay small.
  async function prepImage(blob) {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); // flatten transparency onto paper
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const out = await new Promise(res => c.toBlob(res, "image/jpeg", 0.9));
    const buf = new Uint8Array(await out.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { media_type: "image/jpeg", data: btoa(bin) };
  }

  // Same tolerant parsing as the artifact runtime: whole reply, a fenced block, or first {/[ to last }/].
  function parseJSON(text) {
    try { return JSON.parse(text); } catch {}
    const fence = text.match(/```(?:json)?\s*\n([\s\S]*?)```/);
    if (fence) { try { return JSON.parse(fence[1]); } catch {} }
    const start = text.search(/[\[{]/);
    const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
    if (start >= 0 && end > start) { try { return JSON.parse(text.slice(start, end + 1)); } catch {} }
    throw fail("invalid_json", "Reply was not valid JSON", text);
  }

  async function sample(input, opts = {}) {
    const prompt = typeof input === "string" ? input : input.map(t => t.content).join("\n\n");
    let images = [];
    if (opts.images) {
      const list = opts.images instanceof Blob ? [opts.images] : Array.from(opts.images);
      try { images = await Promise.all(list.map(prepImage)); }
      catch { throw fail("image_rejected", "Could not read image"); }
    }
    if (opts.signal?.aborted) throw fail("cancelled");
    let res;
    try {
      res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, images, json: !!opts._json }),
        signal: opts.signal,
      });
    } catch (e) {
      if (e?.name === "AbortError") throw fail("cancelled");
      throw fail("server_unreachable", "Local server not reachable");
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw fail(body.code || "upstream_error", body.message);
    if (!body.text || !body.text.trim()) throw fail("empty_completion");
    opts.onText?.({ text: body.text, delta: body.text });
    return { text: body.text, truncated: !!body.truncated, modelTierApplied: "default" };
  }

  sample.json = async (input, opts = {}) => {
    const { text, truncated } = await sample(input, { ...opts, _json: true });
    if (truncated) throw fail("invalid_json", "Reply was cut short", text);
    return parseJSON(text);
  };

  sample.limits = async () => ({
    maxPromptBytes: 262144,
    images: { maxCount: 2, maxInputBytes: 20 * 1024 * 1024, mediaTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
  });

  window.claude = { use: async name => (name === "sample" ? sample : null) };
})();
