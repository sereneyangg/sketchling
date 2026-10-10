// Sketchling local server: serves the app and proxies Claude requests so your
// API key stays on the server and never reaches the browser.
// No dependencies — needs Node 18+ (built-in fetch).
import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(ROOT, "public");

// Minimal .env loader (KEY=value lines; real env vars win).
const envPath = join(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

const PORT = Number(process.env.PORT) || 3000;
const MAX_TOKENS = Number(process.env.MAX_TOKENS) || 4096;

// Pick a provider: AI_PROVIDER wins; otherwise whichever key is present (Anthropic first).
const PROVIDER = (process.env.AI_PROVIDER || (process.env.ANTHROPIC_API_KEY ? "anthropic" : process.env.OPENAI_API_KEY ? "openai" : "anthropic")).toLowerCase();
const MODEL = PROVIDER === "openai"
  ? process.env.OPENAI_MODEL || "gpt-6.1-sol"
  : process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const KEY_NAME = PROVIDER === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";

// Each provider: build the request, then pull {text, truncated, usage} from the reply.
const PROVIDERS = {
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    headers: key => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }),
    body: (prompt, images) => ({
      model: MODEL, max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: [
        ...images.map(img => ({ type: "image", source: { type: "base64", media_type: img.media_type, data: img.data } })),
        { type: "text", text: prompt },
      ] }],
    }),
    parse: d => ({
      text: (d.content || []).filter(b => b.type === "text").map(b => b.text).join(""),
      truncated: d.stop_reason === "max_tokens",
      usage: `${d.usage?.input_tokens ?? "?"} in / ${d.usage?.output_tokens ?? "?"} out`,
    }),
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    headers: key => ({ Authorization: `Bearer ${key}` }),
    body: (prompt, images) => ({
      model: MODEL, max_completion_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: [
        ...images.map(img => ({ type: "image_url", image_url: { url: `data:${img.media_type};base64,${img.data}` } })),
        { type: "text", text: prompt },
      ] }],
    }),
    parse: d => ({
      text: d.choices?.[0]?.message?.content || "",
      truncated: d.choices?.[0]?.finish_reason === "length",
      usage: `${d.usage?.prompt_tokens ?? "?"} in / ${d.usage?.completion_tokens ?? "?"} out`,
    }),
  },
};
const P = PROVIDERS[PROVIDER];
if (!P) { console.error(`Unknown AI_PROVIDER "${PROVIDER}". Use "anthropic" or "openai".`); process.exit(1); }
const MAX_BODY = 25 * 1024 * 1024;

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

function send(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", c => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error("Request too large"), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handleClaude(req, res) {
  const key = process.env[KEY_NAME];
  if (!key) return send(res, 500, { code: "not_configured", message: `${KEY_NAME} is not set` });

  let body;
  try { body = JSON.parse(await readBody(req)); }
  catch (e) { return send(res, e.status || 400, { code: "invalid_request", message: e.message }); }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return send(res, 400, { code: "invalid_request", message: "Missing prompt" });

  const images = (Array.isArray(body.images) ? body.images.slice(0, 4) : [])
    .filter(img => img && typeof img.data === "string" && /^image\/(jpeg|png|webp|gif)$/.test(img.media_type));
  const fullPrompt = prompt + (body.json ? "\n\nRespond with the JSON value only — no prose, no code fences." : "");

  // Cancel the upstream call if the browser hits Stop.
  const ac = new AbortController();
  res.on("close", () => { if (!res.writableEnded) ac.abort(); });

  let r;
  try {
    r = await fetch(P.url, {
      method: "POST",
      headers: { ...P.headers(key), "content-type": "application/json" },
      body: JSON.stringify(P.body(fullPrompt, images)),
      signal: ac.signal,
    });
  } catch (e) {
    if (ac.signal.aborted) return;
    return send(res, 502, { code: "upstream_error", message: `Could not reach the ${PROVIDER} API: ${e.message}` });
  }

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const message = data?.error?.message || `${PROVIDER} API returned ${r.status}`;
    const code = r.status === 401 || r.status === 403 ? "not_configured"
      : r.status === 429 ? "rate_limited"
      : r.status === 400 ? "invalid_request"
      : "upstream_error";
    console.error(`[${PROVIDER}] ${r.status}: ${message}`);
    return send(res, r.status, { code, message });
  }

  const { text, truncated, usage } = P.parse(data);
  console.log(`[${PROVIDER}] ${MODEL} · ${images.length} image(s) · ${usage}`);
  send(res, 200, { text, truncated });
}

async function handleImageEdit(req,res){
 const key=process.env.OPENAI_API_KEY;
 if(!key)return send(res,503,{message:"Drawing edits need OPENAI_API_KEY in .env. Your analysis provider can remain Anthropic."});
 let body;try{body=JSON.parse(await readBody(req));}catch(e){return send(res,e.status||400,{message:"Invalid edit request"});}
 const png=v=>typeof v==="string"&&v.length<12*1024*1024&&/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(v);
 const r=body.region;
 if(!png(body.drawing)||!png(body.reference)||!png(body.mask)||!r||![r.x,r.y,r.w,r.h].every(Number.isFinite)||r.x<0||r.y<0||r.w<1||r.h<1||r.x+r.w>100||r.y+r.h>100)return send(res,400,{message:"Send drawing, reference, mask and a valid edit area."});
 const feature=String(body.feature||"selected feature").slice(0,120),reason=String(body.reason||"").slice(0,400);
 const prompt=`Edit image 1, a student's pencil/charcoal drawing. Image 2 is the aligned photographic reference, for observation only. Return ONE drawing, same composition, scale and paper texture as image 1. The transparent mask identifies the only editable area: ${feature}, at x=${r.x}, y=${r.y}, width=${r.w}, height=${r.h} percent of the sheet. Compare this feature's actual shape, position and shadow masses against image 2. Suggested concern: ${reason}. Make a modest, teachable correction only where supported by the reference. Preserve identity, pencil style, surrounding features and highlights. Remove misplaced heavy lines with subtle erasing, replace with light broken pencil contours, group shadows where needed. Left and right mean the viewer’s image left and right. Do not render the mask itself. Return opaque drawing paper, without transparent cutouts or solid rectangular fills. Do not paste photographic pixels, add labels, diagrams, arrows, color or panels. Do not beautify or redraw the whole face. If the suggested concern is not supported, retain the original feature. Preserve every unmasked part and all landmarks outside this area.`;
 const payload={model:process.env.OPENAI_IMAGE_MODEL||"gpt-image-1.5",images:[{image_url:body.drawing},{image_url:body.reference}],mask:{image_url:body.mask},prompt,n:1,size:"1024x1024",quality:"medium",output_format:"png",background:"opaque"};
 if(["gpt-image-1","gpt-image-1.5"].includes(payload.model))payload.input_fidelity="high";
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),240000);res.on("close",()=>{if(!res.writableEnded)ac.abort();});
 try{
  const response=await fetch("https://api.openai.com/v1/images/edits",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(payload),signal:ac.signal});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return send(res,response.status,{message:data.error?.message||`Image editing returned ${response.status}`});
  const b64=data.data?.[0]?.b64_json;if(!b64)return send(res,502,{message:"The image editor did not return PNG image data."});
  send(res,200,{image:`data:image/png;base64,${b64}`});
 }catch(e){if(!res.destroyed)send(res,502,{message:ac.signal.aborted?"Image editing stopped or timed out.":"Could not reach image editing. Check your connection and retry."});}finally{clearTimeout(timer);}
}

async function handleStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  let path = decodeURIComponent(url.pathname);
  if (path === "/") path = "/index.html";
  const file = normalize(join(PUBLIC, path));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
  }
}

http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/claude") return handleClaude(req, res).catch(e => send(res, 500, { code: "upstream_error", message: e.message }));
  if (req.method === "POST" && req.url === "/api/image-edit") return handleImageEdit(req,res).catch(e=>send(res,500,{message:e.message}));
  if (req.method === "GET") return handleStatic(req, res);
  res.writeHead(405).end();
}).listen(PORT, () => {
  console.log(`Sketchling running at http://localhost:${PORT}`);
  console.log(`Provider: ${PROVIDER} · Model: ${MODEL}${process.env[KEY_NAME] ? "" : `  (⚠ ${KEY_NAME} not set — lessons and feedback will fail)`}`);
});
