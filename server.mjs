import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { extname, join, normalize, sep } from "node:path";
import { emotions } from "./public/emotions.js";

const rootDir = import.meta.dirname;
const envPath = process.env.FEELING_FACE_ENV_PATH || join(rootDir, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || (process.env.RENDER ? "0.0.0.0" : "127.0.0.1");
const publicDir = join(rootDir, "public");
const cache = new Map();
const rateWindows = new Map();
const CACHE_MS = 5 * 60 * 1000;
const REQUESTS_PER_MINUTE = Number(process.env.REQUESTS_PER_MINUTE || 120);
const FRIEND_ACCESS_TOKEN = process.env.FRIEND_ACCESS_TOKEN || "";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "";
const MAX_DAILY_JEV_CALLS = Number(process.env.MAX_DAILY_JEV_CALLS || 0);
let dailyCalls = { day: "", count: 0 };

if (process.env.RENDER && (!process.env.TYPESAFE_API_KEY || !FRIEND_ACCESS_TOKEN || !ALLOWED_ORIGIN)) {
  throw new Error("Render deployment requires TYPESAFE_API_KEY, FRIEND_ACCESS_TOKEN, and ALLOWED_ORIGIN.");
}

function validAccessToken(header) {
  if (!FRIEND_ACCESS_TOKEN) return true;
  const supplied = /^Bearer (.+)$/.exec(String(header || ""))?.[1] || "";
  const expected = Buffer.from(FRIEND_ACCESS_TOKEN);
  const actual = Buffer.from(supplied);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function countJevCall() {
  if (MAX_DAILY_JEV_CALLS <= 0) return;
  const today = new Date().toISOString().slice(0, 10);
  if (dailyCalls.day !== today) dailyCalls = { day: today, count: 0 };
  if (dailyCalls.count >= MAX_DAILY_JEV_CALLS) {
    const error = new Error("오늘의 Jev 호출 한도에 도달했습니다.");
    error.status = 429;
    throw error;
  }
  dailyCalls.count++;
}

const emotionCriteria = Object.fromEntries(
  Object.entries(emotions).map(([key, emotion]) => [key, {
    definition: emotion.definition,
    central_appraisal: emotion.criteria.appraisal,
    positive_evidence: emotion.criteria.evidence,
    distinguish_from_neighbors: emotion.criteria.boundary,
    insufficient_evidence: emotion.criteria.insufficient,
  }]),
);

const signalQuestions = Object.fromEntries(
  Object.entries(emotions).map(([key, emotion]) => [`signal_${key}`, {
    type: "noul",
    instructions: {
      question: key === "neutral"
        ? "Would a typical recipient of `user_text` have no text-supported reason to feel any of the six specified emotions? Do not use neutral merely because several non-neutral reactions are plausible."
        : `Could the recipient of \`user_text\` plausibly feel ${key} (${emotion.label}) because of the message, even if another reaction is more likely? Judge the recipient, not the writer.`,
      definition: emotion.definition,
      central_appraisal: emotion.criteria.appraisal,
      distinguish_from_neighbors: emotion.criteria.boundary,
    },
    criteria: {
      true: `The message gives the recipient a concrete reason for ${emotion.label}: ${emotion.criteria.evidence.join("; ")}.`,
      false: `The recipient has no text-supported reason for ${emotion.label}, or a neighboring emotion explains their likely reaction better.`,
    },
  }]),
);

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function allowRequest(ip) {
  const now = Date.now();
  const window = rateWindows.get(ip) || [];
  const recent = window.filter((timestamp) => now - timestamp < 60_000);
  recent.push(now);
  rateWindows.set(ip, recent);
  return recent.length <= REQUESTS_PER_MINUTE;
}

async function analyze(text) {
  if (!process.env.TYPESAFE_API_KEY) return { error: "missing_api_key" };

  const cacheKey = text.toLocaleLowerCase("ko-KR");
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt < CACHE_MS) return { ...cached.result, cached: true };

  countJevCall();

  const response = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "jev-latest",
      state: {
        user_text: text,
        context: "A sender is composing a short Korean or English message addressed to another person. Predict a plausible immediate reaction of the recipient to receiving this message, NOT the sender's current feeling. Their relationship and hidden circumstances are unknown. Treat this as a text-grounded possibility, never a measurement of the actual recipient. First-person emotion words belong to the sender unless they convey an event likely to affect the recipient.",
      },
      questions: {
        dominant_emotion: {
          type: "choice",
          instructions: {
            task: "Which single emotion is the most text-supported immediate reaction for the recipient of `user_text`?",
            method: [
              "Read the message as something the recipient receives. Identify whether it offers the recipient a benefit, loss, threat, boundary violation, unexpected change, or repulsive contact. Do not mirror the sender's emotion.",
              "Consider explicit second-person references, consequences for the recipient, social tone, and what the recipient can reasonably know from the message. Never invent a personal history or relationship.",
              "Compare close alternatives using each option's `distinguish_from_neighbors` guidance.",
              "Choose neutral only when the message gives no concrete reason for any of the six emotions, such as a purely routine logistical exchange. Do not choose neutral merely because several non-neutral reactions are possible; choose the best-supported one and preserve ambiguity in probabilities.",
              "Do not infer the actual recipient's hidden mental state. A polite, weakly emotional, or ambiguous sentence can yield low confidence.",
            ],
          },
          criteria: emotionCriteria,
        },
        intensity: {
          type: "score",
          instructions: "How strong is the recipient's likely immediate emotional reaction to the event or interpersonal meaning conveyed by `user_text`? This is reaction intensity, not probability, and not the sender's writing intensity. Judge the magnitude, personal stakes, directness, and urgency of the recipient-facing content. Punctuation alone is weak evidence. Score near zero when the dominant outcome is neutral.",
          criteria: [
            "0 — None or barely discernible: routine information, weak implication, or no clear consequence for the recipient.",
            "1 — Mild: a small compliment, minor disappointment, slight uncertainty, or low-stakes surprise.",
            "2 — Moderate: a clear emotional implication with meaningful but not major personal stakes.",
            "3 — Strong: serious personal news, credible immediate concern, marked betrayal, major success, or major loss.",
            "4 — Extreme: life-changing or immediate high-stakes event likely to dominate the recipient's attention. Do not use this level for emphatic punctuation alone.",
          ],
        },
        ...signalQuestions,
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || data?.message || `TypeSafe API ${response.status}`);

  const emotion = data.answers.dominant_emotion;
  const intensity = data.answers.intensity;
  const probabilities = Object.fromEntries(
    Object.keys(emotions).map((key) => [key, Number(data.answers[`signal_${key}`]?.noul || 0)]),
  );
  const result = {
    emotion: emotion.choice,
    confidence: emotion.confidence,
    probabilities,
    choiceProbabilities: emotion.probabilities,
    intensity: Math.max(0, Math.min(1, (Number(intensity.score) || 0) / 4)),
    intensityScore: intensity.score,
    model: data.model,
  };
  cache.set(cacheKey, { savedAt: Date.now(), result });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return result;
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/api/analyze") {
    const origin = req.headers.origin;
    const permittedOrigin = ALLOWED_ORIGIN || url.origin;
    if (origin && origin !== permittedOrigin) return send(res, 403, { error: "허용되지 않은 사이트입니다." });
    if (origin && origin === permittedOrigin) {
      res.setHeader("access-control-allow-origin", permittedOrigin);
      res.setHeader("vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "authorization, content-type",
        "access-control-max-age": "600",
      });
      return res.end();
    }
    if (req.method !== "POST") return send(res, 405, { error: "허용되지 않은 요청입니다." });
    if (!validAccessToken(req.headers.authorization)) return send(res, 401, { error: "친구 전용 접근 코드를 확인해 주세요." });
    const ip = String(req.socket.remoteAddress || "local");
    if (!allowRequest(ip)) return send(res, 429, { error: "요청이 너무 빠릅니다. 잠시 후 다시 입력해 주세요." });

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_000) req.destroy();
    });
    req.on("end", async () => {
      try {
        const { text } = JSON.parse(body || "{}");
        if (typeof text !== "string" || !text.trim()) return send(res, 400, { error: "텍스트를 입력해 주세요." });
        if (text.length > 1000) return send(res, 400, { error: "1,000자 이내로 입력해 주세요." });
        send(res, 200, await analyze(text.trim()));
      } catch (error) {
        if (!res.headersSent) send(res, error.status || 502, { error: error.message || "분석에 실패했습니다." });
      }
    });
    return;
  }

  const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const file = normalize(join(publicDir, requested));
  if (!file.startsWith(publicDir + sep) || !existsSync(file)) return send(res, 404, "Not found", "text/plain; charset=utf-8");
  res.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
});
server.listen(port, host, () => {
  const actualPort = server.address().port;
  console.log(`Feeling Face: http://${host === "0.0.0.0" ? "localhost" : host}:${actualPort}`);
});
