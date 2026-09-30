import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

// Face Cap's 52 channels follow ARKit-style facial movements. Values are
// visual prototypes, not a claim that one expression proves an inner state.
const expression = {
  neutral: {},
  joy: { mouthSmile_L: .93, mouthSmile_R: .88, cheekSquint_L: .56, cheekSquint_R: .52, eyeSquint_L: .16, eyeSquint_R: .16, mouthDimple_L: .25, mouthDimple_R: .22 },
  sadness: { browInnerUp: .86, browDown_L: .16, browDown_R: .14, mouthFrown_L: .72, mouthFrown_R: .76, mouthLowerDown_L: .12, mouthLowerDown_R: .12, eyeLookDown_L: .14, eyeLookDown_R: .14 },
  anger: { browDown_L: .9, browDown_R: .93, eyeSquint_L: .62, eyeSquint_R: .58, mouthPress_L: .77, mouthPress_R: .8, jawForward: .22, noseSneer_L: .16, noseSneer_R: .15 },
  fear: { browInnerUp: .82, browOuterUp_L: .72, browOuterUp_R: .7, eyeWide_L: .92, eyeWide_R: .9, mouthStretch_L: .71, mouthStretch_R: .67, jawOpen: .46 },
  surprise: { browInnerUp: .9, browOuterUp_L: .9, browOuterUp_R: .88, eyeWide_L: 1, eyeWide_R: .98, jawOpen: .82, mouthFunnel: .26 },
  disgust: { noseSneer_L: .95, noseSneer_R: .8, mouthUpperUp_L: .8, mouthUpperUp_R: .73, mouthFrown_L: .27, mouthFrown_R: .24, eyeSquint_L: .31, eyeSquint_R: .28 },
};

const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));

function targetExpression(probabilities, intensity, dominant) {
  const target = {};
  const primary = expression[dominant] || {};
  const expressive = Object.entries(probabilities || {}).filter(([key]) => key !== "neutral");
  const total = expressive.reduce((sum, [, value]) => sum + Number(value || 0), 0) || 1;
  const strength = dominant === "neutral" ? .04 : clamp(.22 + intensity * 1.04, .12, 1.25);
  for (const [key, value] of Object.entries(primary)) target[key] = value * .76 * strength;
  for (const [emotion, likelihood] of expressive) {
    for (const [key, value] of Object.entries(expression[emotion] || {})) {
      target[key] = (target[key] || 0) + value * .24 * Number(likelihood || 0) / total * strength;
    }
  }
  return target;
}

export async function init3DFace(container, onReady) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 20);
  camera.position.set(0, .2, 4.05);
  camera.lookAt(0, .13, -.1);
  scene.add(new THREE.HemisphereLight(0xfff8f2, 0x8b6470, 2.1));
  const key = new THREE.DirectionalLight(0xffe4d4, 2.3);
  key.position.set(-2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xd7e3ff, 1.6);
  rim.position.set(3, 1, -3);
  scene.add(rim);

  const ktx2 = new KTX2Loader().setTranscoderPath(new URL("./basis/", import.meta.url).href).detectSupport(renderer);
  const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  let gltf;
  try {
    gltf = await loader.loadAsync(new URL("./models/facecap.glb", import.meta.url).href);
  } catch (error) {
    renderer.dispose();
    ktx2.dispose();
    renderer.domElement.remove();
    throw error;
  }

  const model = gltf.scene;
  scene.add(model);
  let head;
  model.traverse((node) => {
    if (node.isMesh && node.morphTargetDictionary && Object.keys(node.morphTargetDictionary).length >= 40) head = node;
  });
  if (!head) throw new Error("3D 모델에 얼굴 블렌드셰이프가 없습니다.");
  const shapeIndex = head.morphTargetDictionary;
  const channels = Object.entries(shapeIndex);
  const influences = head.morphTargetInfluences;
  const rest = [...influences];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let targets = {};
  let activeEmotion = "neutral";
  let last = performance.now();
  let nextBlink = last + 1800;
  let blinkStart = -Infinity;

  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const update = (probabilities, intensity, dominant) => {
    activeEmotion = dominant;
    targets = targetExpression(probabilities, intensity, dominant);
  };

  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const dt = Math.min((now - last) / 1000, .08);
    last = now;
    if (now >= nextBlink) {
      blinkStart = now;
      nextBlink = now + 2800 + Math.random() * 3000;
    }
    const blinkPhase = (now - blinkStart) / 240;
    const blink = !reducedMotion.matches && blinkPhase >= 0 && blinkPhase < 1 ? Math.sin(blinkPhase * Math.PI) : 0;
    const gazeX = reducedMotion.matches ? 0 : Math.sin(now / 2200) * .055;
    const gazeY = reducedMotion.matches ? 0 : Math.sin(now / 3100) * .025;
    const gazeWeights = {
      eyeLookOut_L: Math.max(0, gazeX), eyeLookIn_R: Math.max(0, gazeX),
      eyeLookIn_L: Math.max(0, -gazeX), eyeLookOut_R: Math.max(0, -gazeX),
      eyeLookUp_L: Math.max(0, gazeY), eyeLookUp_R: Math.max(0, gazeY),
      eyeLookDown_L: Math.max(0, -gazeY), eyeLookDown_R: Math.max(0, -gazeY),
    };
    for (const [name, index] of channels) {
      const gaze = gazeWeights[name] || 0;
      const relaxedLid = (name === "eyeSquint_L" || name === "eyeSquint_R") && activeEmotion === "neutral" ? .2 : 0;
      const desired = clamp((targets[name] || 0) + gaze + relaxedLid + ((name === "eyeBlink_L" || name === "eyeBlink_R") ? blink : 0));
      influences[index] += (desired - influences[index]) * (reducedMotion.matches ? 1 : 1 - Math.exp(-dt * 8));
    }
    if (!reducedMotion.matches) {
      const attentive = activeEmotion === "surprise" || activeEmotion === "fear" ? .02 : 0;
      model.rotation.y = Math.sin(now / 2600) * .035;
      model.rotation.z = Math.sin(now / 4200) * .012;
      model.rotation.x = Math.sin(now / 3400) * .009 - attentive;
      model.position.y = Math.sin(now / 1800) * .012;
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  onReady();
  return { update, channels: channels.length, reset: () => rest.forEach((value, index) => { influences[index] = value; }) };
}
