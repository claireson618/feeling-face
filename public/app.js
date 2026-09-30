import { emotions, emotionOrder } from "./emotions.js";

const $ = (id) => document.getElementById(id);
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const neutralDistribution = () => Object.fromEntries(emotionOrder.map((key) => [key, key === "neutral" ? 1 : 0]));
const configuredApiBase = String(window.FEELING_FACE_API_BASE_URL || "").trim();
const hostedMode = Boolean(configuredApiBase);
const analyzeUrl = hostedMode ? new URL("/api/analyze", configuredApiBase).href : "/api/analyze";
let accessToken = hostedMode ? (sessionStorage.getItem("feeling-face-access-token") || "") : "";

let debounceTimer;
let activeController;
let requestSequence = 0;
let lastAnalyzedText = "";

function setPath(id, d) { $(id).setAttribute("d", d); }
function weightedPose(probabilities, intensity, leadingEmotion) {
  const pose = {};
  const expressiveTotal = Object.entries(probabilities || {})
    .filter(([emotion]) => emotion !== "neutral")
    .reduce((sum, [, probability]) => sum + probability, 0);
  const normalizer = Math.max(1, expressiveTotal);
  for (const [emotion, probability] of Object.entries(probabilities || {})) {
    for (const [movement, amount] of Object.entries(emotions[emotion]?.pose || {})) {
      pose[movement] = (pose[movement] || 0) + amount * (probability / normalizer);
    }
  }
  // A clear prototype keeps visually similar emotions distinct; other signals
  // still contribute to the remaining 28% of the expression.
  const primary = emotions[leadingEmotion]?.pose || {};
  const strength = leadingEmotion === "neutral" ? 0 : clamp(0.72 + intensity * 1.25, 0, 1.75);
  for (const key of new Set([...Object.keys(pose), ...Object.keys(primary)])) {
    pose[key] = clamp(((primary[key] || 0) * .72 + (pose[key] || 0) * .28) * strength, -1.55, 1.55);
  }
  return new Proxy(pose, { get: (target, key) => target[key] || 0 });
}

function renderFace(probabilities, intensity = 1, leadingEmotion = "neutral") {
  const p = weightedPose(probabilities, intensity, leadingEmotion);
  const outerLY = 222 - p.outerBrow * 27 + p.browDown * 10;
  const innerLY = 222 - p.innerBrow * 32 + p.browDown * 12;
  const browCurve = 202 - (p.innerBrow + p.outerBrow) * 9 + p.browDown * 16;
  setPath("brow-l", `M137 ${outerLY}Q168 ${browCurve} 199 ${innerLY}`);
  setPath("brow-r", `M242 ${innerLY}Q273 ${browCurve} 304 ${outerLY}`);

  const eyeHeight = clamp(18 + p.eyeOpen * 25 - p.lidTight * 13, 4, 45);
  const eyeTop = 260 - eyeHeight / 2;
  const eyeBottom = 260 + eyeHeight / 2;
  setPath("eye-white-l", `M139 260Q168 ${eyeTop} 197 260Q168 ${eyeBottom} 139 260Z`);
  setPath("eye-white-r", `M244 260Q273 ${eyeTop} 302 260Q273 ${eyeBottom} 244 260Z`);
  const gaze = p.gazeAway * 9;
  $("iris-l").setAttribute("ry", String(Math.min(10, eyeHeight * .35)));
  $("iris-r").setAttribute("ry", String(Math.min(10, eyeHeight * .35)));
  $("iris-l").setAttribute("cx", String(169 - gaze)); $("pupil-l").setAttribute("cx", String(169 - gaze));
  $("iris-r").setAttribute("cx", String(273 - gaze)); $("pupil-r").setAttribute("cx", String(273 - gaze));
  const lidY = 266 - p.lowerLid * 10 - p.cheekRaise * 9 + p.lidTight * 4;
  setPath("lower-lid-l", `M142 ${lidY}q26 ${17 - p.lowerLid * 12} 52 0`);
  setPath("lower-lid-r", `M247 ${lidY}q26 ${17 - p.lowerLid * 12} 52 0`);

  const cornerBase = 365 - p.smile * 32 + p.frown * 28;
  const leftCorner = cornerBase + p.asymmetric * 5;
  const rightCorner = cornerBase - p.asymmetric * 14;
  const stretch = p.mouthStretch * 18 + p.smile * 8;
  const effectiveOpen = clamp(p.mouthOpen + p.jawDrop * 0.62 - p.lipPress * 0.85, 0, 1.9);
  const topMid = 357 - p.smile * 9 - p.upperLipRaise * 21 + p.frown * 4;
  const cavityBottom = 369 + effectiveOpen * 32;
  setPath("mouth-cavity", `M${164 - stretch} ${leftCorner}Q221 ${topMid} ${278 + stretch} ${rightCorner}C${288 + stretch} ${cavityBottom - 7} 270 ${cavityBottom} 221 ${cavityBottom}C172 ${cavityBottom} ${154 - stretch} ${cavityBottom - 7} ${164 - stretch} ${leftCorner}Z`);
  setPath("teeth", `M${171 - stretch / 2} ${Math.min(leftCorner, rightCorner) + 2}Q221 ${topMid + 5} ${271 + stretch / 2} ${Math.min(leftCorner, rightCorner) + 2}Q221 ${Math.min(leftCorner, rightCorner) + 10 + effectiveOpen * 3} ${171 - stretch / 2} ${Math.min(leftCorner, rightCorner) + 2}Z`);
  setPath("upper-lip", `M${164 - stretch} ${leftCorner}Q193 ${topMid - 7} 221 ${topMid}Q249 ${topMid - 7} ${278 + stretch} ${rightCorner}Q221 ${topMid + 10} ${164 - stretch} ${leftCorner}Z`);
  setPath("lower-lip", `M${164 - stretch} ${leftCorner}C${159 - stretch} ${cavityBottom - 7} 172 ${cavityBottom + 2} 221 ${cavityBottom + 2}C270 ${cavityBottom + 2} ${283 + stretch} ${cavityBottom - 7} ${278 + stretch} ${rightCorner}C${284 + stretch} ${cavityBottom + 10} 271 ${cavityBottom + 13} 221 ${cavityBottom + 13}C171 ${cavityBottom + 13} ${158 - stretch} ${cavityBottom + 10} ${164 - stretch} ${leftCorner}Z`);
  setPath("lip-press", `M${171 - stretch / 2} ${367 - p.smile * 8 + p.frown * 7}q50 ${p.asymmetric * -4} 100 0`);
  setPath("chin-line", `M190 ${412 - p.chinRaise * 15 + p.jawDrop * 13}q31 ${12 - p.chinRaise * 11} 62 0`);
  setPath("jaw", `M151 363q10 ${83 + p.jawDrop * 18} 70 ${90 + p.jawDrop * 21}q60 ${-7 - p.jawDrop * 3} 70 ${-90 - p.jawDrop * 18}`);

  const noseAmount = p.noseWrinkle;
  $("nose-wrinkle-1").style.opacity = String(clamp(noseAmount * 1.6));
  $("nose-wrinkle-2").style.opacity = String(clamp(noseAmount * 1.4));
  $("nostrils").style.transform = `scaleX(${1 + p.nostril * .35 + noseAmount * .15})`;
  $("forehead-1").style.opacity = String(clamp((p.innerBrow + p.outerBrow) * .62));
  $("forehead-2").style.opacity = String(clamp((p.innerBrow + p.outerBrow) * .42));
  $("crow-l").style.opacity = $("crow-r").style.opacity = String(clamp(p.cheekRaise * .92));
  $("cheek-l").style.opacity = $("cheek-r").style.opacity = String(clamp(p.cheekRaise * .75));
  $("nasolabial-l").style.opacity = $("nasolabial-r").style.opacity = String(clamp(p.nasolabial));
  $("blush-l").style.opacity = $("blush-r").style.opacity = String(clamp(p.blush * .85));
  $("teeth").style.opacity = String(clamp(effectiveOpen * 1.8));
  $("lip-press").style.opacity = String(clamp(p.lipPress));
  $("mouth-cavity").style.opacity = String(clamp(effectiveOpen * 2));

  const leading = emotions[leadingEmotion] || emotions.neutral;
  $("face").dataset.emotion = leadingEmotion;
  $("face").setAttribute("aria-label", `${leading.label} 중심의 혼합 표정`);
  $("emotion-label").textContent = leading.label;
  $("emotion-definition").textContent = leading.definition;
  $("au-list").innerHTML = leading.aus.map(({ au, action, muscle }) => `<li><b>${au}</b><span>${action}</span><em>${muscle}</em></li>`).join("");
}

function probabilityBars(probabilities = neutralDistribution(), leadingEmotion = "neutral") {
  $("probabilities").innerHTML = Object.entries(probabilities)
    .sort((a, b) => b[1] - a[1])
    .map(([emotion, probability], index) => `
          <div class="probability ${emotion === leadingEmotion ? "leading" : ""}" title="${emotions[emotion]?.label || emotion}이 문장에 존재할 Jev의 독립 확률">
        <span><i>${String(index + 1).padStart(2, "0")}</i>${emotions[emotion]?.label || emotion}</span>
        <div><b style="width:${Math.max(1, probability * 100)}%"></b></div>
        <em>${(probability * 100).toFixed(probability < .01 ? 1 : 0)}%</em>
      </div>`).join("");
}

function demoResult(text) {
  const hints = [
    [/(기뻐|해냈|신나|좋아|사랑|소중|다행)/, "joy"],
    [/(슬퍼|허탈|외로|상실|그립)/, "sadness"],
    [/(부당|용서할 수|화가|막혀|답답)/, "anger"],
    [/(무서|도망|위험|걱정|불안|신경 쓰)/, "fear"],
    [/(갑자기|깜짝|예상 못)/, "surprise"],
    [/(역겨|더러|토할)/, "disgust"],
  ];
  const leading = hints.find(([pattern]) => pattern.test(text))?.[1] || "neutral";
  const probabilities = Object.fromEntries(emotionOrder.map((key) => [key, key === leading ? .67 : .33 / (emotionOrder.length - 1)]));
  return { emotion: leading, probabilities, intensity: .68, confidence: .58, model: "local-demo" };
}

function setStatus(message, state = "idle") {
  $("status").textContent = message;
  $("live-dot").dataset.state = state;
}

function updateAccessView() {
  $("access-form").hidden = !hostedMode || Boolean(accessToken);
  $("change-access").hidden = !hostedMode || !accessToken;
}

function applyResult(result) {
  renderFace(result.probabilities, result.intensity, result.emotion);
  probabilityBars(result.probabilities, result.emotion);
  $("dominant-probability").textContent = result.empty ? "—" : `${Math.round((result.probabilities[result.emotion] || 0) * 100)}%`;
  $("confidence").textContent = `${Math.round(result.confidence * 100)}%`;
  setStatus(`${result.model}${result.cached ? " · cache" : ""} · 강도 ${Math.round(result.intensity * 100)}%`, "ready");
}

async function analyzeText(text, immediate = false) {
  clearTimeout(debounceTimer);
  activeController?.abort();
  const revision = ++requestSequence;
  const clean = text.trim();
  $("character-count").textContent = `${text.length.toLocaleString()} / 1,000`;
  if (!clean) {
    lastAnalyzedText = "";
    applyResult({ emotion: "neutral", probabilities: neutralDistribution(), intensity: 0, confidence: 0, model: "대기", empty: true });
    setStatus("두 글자 이상 입력하면 자동으로 분석합니다.", "idle");
    return;
  }
  if (clean.length < 2) {
    setStatus("한 글자만 더 입력해 주세요.", "waiting");
    return;
  }
  if (!immediate && clean === lastAnalyzedText) return;
  if (hostedMode && !accessToken) {
    updateAccessView();
    setStatus("친구 전용 접근 코드를 먼저 입력해 주세요.", "waiting");
    return;
  }

  const run = async () => {
    activeController = new AbortController();
    setStatus("Jev가 지금 문장을 읽고 있습니다…", "analyzing");
    try {
      const response = await fetch(analyzeUrl, {
        method: "POST",
        headers: { "content-type": "application/json", ...(hostedMode ? { authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ text: clean }),
        signal: activeController.signal,
      });
      const result = await response.json();
      if (revision !== requestSequence) return;
      if (response.status === 401 && hostedMode) {
        accessToken = "";
        sessionStorage.removeItem("feeling-face-access-token");
        updateAccessView();
        setStatus(result.error || "접근 코드를 다시 입력해 주세요.", "error");
        return;
      }
      if (result.error === "missing_api_key" && !hostedMode) return applyResult(demoResult(clean));
      if (!response.ok) throw new Error(result.error);
      lastAnalyzedText = clean;
      applyResult(result);
    } catch (error) {
      if (revision === requestSequence && error.name !== "AbortError") setStatus(error.message || "분석에 실패했습니다.", "error");
    }
  };

  if (immediate) await run();
  else {
    setStatus("입력이 멈추면 곧 분석합니다…", "waiting");
    debounceTimer = setTimeout(run, 200);
  }
}

$("message").addEventListener("input", (event) => analyzeText(event.target.value));
$("access-form").addEventListener("submit", (event) => {
  event.preventDefault();
  accessToken = $("access-token").value.trim();
  if (!accessToken) return;
  sessionStorage.setItem("feeling-face-access-token", accessToken);
  $("access-token").value = "";
  updateAccessView();
  setStatus("접근 코드가 저장되었습니다. 문장을 입력해 주세요.", "ready");
  if ($("message").value.trim().length >= 2) analyzeText($("message").value, true);
});
$("change-access").addEventListener("click", () => {
  accessToken = "";
  sessionStorage.removeItem("feeling-face-access-token");
  updateAccessView();
  $("access-token").focus();
});
$("emotion-form").addEventListener("submit", (event) => {
  event.preventDefault();
  analyzeText($("message").value, true);
});
document.querySelectorAll("[data-text]").forEach((button) => button.addEventListener("click", () => {
  $("message").value = button.dataset.text;
  analyzeText(button.dataset.text, true);
}));

const start = neutralDistribution();
renderFace(start, 0, "neutral");
probabilityBars(start, "neutral");
updateAccessView();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register(new URL("./sw.js", import.meta.url)).catch(() => {});
}
