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
  }]),
);

const signalQuestions = Object.fromEntries(
  Object.entries(emotions).map(([key, emotion]) => [`signal_${key}`, {
    type: "noul",
    instructions: {
      question: key === "neutral"
        ? "Is `user_text` genuinely emotionally neutral, with no specific emotion meaningfully present?"
        : `Is the emotion ${key} (${emotion.label}) meaningfully present in \`user_text\`, even if it is not the dominant emotion?`,
      definition: emotion.definition,
      central_appraisal: emotion.criteria.appraisal,
      distinguish_from_neighbors: emotion.criteria.boundary,
    },
    criteria: {
      true: `The text contains direct or contextual evidence of ${emotion.label}: ${emotion.criteria.evidence.join("; ")}.`,
      false: `The text does not express ${emotion.label}, or a neighboring emotion explains the evidence better.`,
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
        context: "A person is typing a short, informal message in Korean or English. Judge only emotion expressed by the words; do not diagnose the writer.",
      },
      questions: {
        dominant_emotion: {
          type: "choice",
          instructions: {
            task: "Which single emotion is most central in `user_text` right now?",
            method: [
              "Use the writer's appraisal, target, time orientation, action tendency, and arousal—not isolated keywords.",
              "Compare close alternatives using each option's `distinguish_from_neighbors` guidance.",
              "Choose neutral only when no emotion is clearly more central; a sentence may contain several emotions, and probabilities should preserve that ambiguity.",
              "Do not infer hidden mental states beyond the text.",
            ],
          },
          criteria: emotionCriteria,
        },
        intensity: {
          type: "score",
          instructions: "How strongly is the central emotion expressed in `user_text`? Judge explicitness, emphasis, repetition, punctuation, urgency, and emotional energy—not which emotion it is.",
          criteria: [
            "Barely present: mostly informational or so indirect that the emotion is difficult to locate.",
            "Mild: recognizable but restrained, tentative, or low-energy.",
            "Moderate: clear and central without strong amplification.",
            "Strong: emphatic wording, urgency, repetition, intensifiers, or high emotional energy.",
            "Overwhelming: extreme, consuming, or explosive expression dominates the message.",
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
    intensity: Math.max(0.12, Math.min(1, (Number(intensity.score) || 0) / 4)),
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
