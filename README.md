# Feeling Face

상대에게 보낼 문장을 입력하면 Jev가 **받는 사람의 가능한 반응**을 추정하고, 6가지 감정과 중립의 신호·반응 강도를 3D 얼굴로 시각화하는 웹·macOS 앱입니다. 실제 수신자의 감정을 측정하지는 않습니다.

## 로컬 실행

Node.js 22 이상이 필요합니다.

```bash
npm ci
npm start
```

브라우저에서 `http://localhost:4173`을 엽니다. `.env`에는 제공된 TypeSafe API 키가 저장되어 있으며 `.gitignore`에 포함됩니다. 소스 저장소나 압축 파일을 공유할 때 `.env`는 절대 포함하지 마세요.

## 동작 구조

1. 사용자가 입력하면 200ms 디바운스 후 서버에 현재 문장을 보냅니다. 새 입력이 생기면 이전 응답은 화면에 적용하지 않습니다.
2. 서버는 Jev `Choice`로 수신자의 주된 예상 반응을, 감정별 `Noul`로 6감정과 중립의 독립 확률을, `Score`로 수신자 반응의 강도(0–4)를 한 요청에서 얻습니다.
3. 우측 상단 숫자는 `Choice`의 선택 확신도이며 각 막대는 별도 `Noul` 확률입니다. 강도는 별도의 척도이며 확률이 아닙니다. 빈 입력에는 중립 100%를 표시하지 않습니다.
4. Face Cap 3D 모델의 52개 얼굴 변형 채널 중 눈썹·눈꺼풀·볼·코·입·턱 채널을 감정별로 조합하고 강도에 따라 변화시킵니다. 천천히 고개가 움직이고 자연스러운 눈 깜빡임이 더해집니다. WebGL이 안 되면 SVG 얼굴로 대체합니다.
5. 동일 문장은 5분간 캐시하며 기본값으로 IP당 분당 120회까지 허용합니다. 입력 간격을 200ms로 낮추면 Jev 호출량과 비용이 증가할 수 있습니다.

## 감정 분류

- 기쁨: 수신자의 성취·안도·관계적 수용처럼 수신자에게 이로운 소식을 전했을 때의 반응.
- 슬픔: 수신자가 소중한 대상이나 기대를 잃었다는 소식을 전했을 때의 반응.
- 분노: 수신자의 권리·경계·존중을 침해하거나 부당하게 막았을 때의 반발.
- 두려움: 수신자의 안전·미래에 해가 닥칠 수 있다는 소식을 전했을 때의 경계.
- 놀람: 수신자에게 기대 밖의 새 정보가 전해졌을 때의 순간적 반응.
- 혐오: 오염·악취·역겨운 행동 등 접촉·수용을 거부하고 싶은 대상이 전해졌을 때의 반응.

각 정의의 핵심 평가, 수신자에게 보내는 문장 예시, 부족한 근거, 인접 감정과의 경계는 [public/emotions.js](./public/emotions.js)에 구조화되어 Jev의 `criteria`로 전달됩니다. 중립은 정서적 결과가 없는 일상 정보일 때의 별도 상태입니다. 감정이 섞였거나 확신도가 낮다는 이유만으로 중립으로 처리하지 않습니다.

## 얼굴 모델

3D 자산은 [Three.js Face Cap 예제](https://threejs.org/examples/webgl_morphtargets_face.html)의 `facecap.glb`이며 원 제작자는 [Bannaflak / Face Cap](https://www.bannaflak.com/face-cap/)입니다. 52개 형태 변형은 ARKit 계열 채널명으로 매핑했습니다. 모델 원본 SHA-256: `6bfce6d0fcbb5839f5102b79733007859fef7c5df6d9eb49e2264542810b5f64`. Three.js 저장소는 MIT 라이선스지만 해당 모델 자산의 **별도 재배포 라이선스 표기는 확인하지 못했습니다**. 향후 상업적 활용이나 광범위한 재배포 전에 제작자에게 사용 범위를 확인하는 편이 안전합니다.

FACS 자체는 얼굴의 보이는 움직임을 기술할 뿐 감정의 원인을 확정하지 않습니다. 문화·맥락·개인차가 크므로 이 앱은 창작·교육용 정서 거울이지 진단 도구가 아닙니다.

## 공유 및 맥 앱

GitHub Pages 프런트엔드와 Render 백엔드를 분리해 배포할 수 있습니다. API 키는 Render의 비밀 환경 변수에만 둡니다. 배포 단계와 친구에게 전달할 내용은 [SHARING.md](./SHARING.md)를 참고하세요.

이 폴더의 `Feeling Face.app`은 WebKit 창과 앱 전용 로컬 서버를 실행하는 macOS 앱입니다. 개인 키는 앱 번들 밖의 `~/Library/Application Support/Feeling Face/.env`에 저장됩니다. 이 Mac에는 Node.js가 설치되어 있어야 합니다. 웹 버전은 PWA로도 설치할 수 있습니다.

## Sources

- [TypeSafe API reference](https://docs.typesafe.ai/api)
- [TypeSafe Choice](https://docs.typesafe.ai/primitives/choice) and [Confidence](https://docs.typesafe.ai/confidence)
- [Paul Ekman Group: universal emotions](https://www.paulekman.com/universal-emotions/)
- [Systematic review of FACS use and AU-to-emotion rules](https://pmc.ncbi.nlm.nih.gov/articles/PMC7264164/)
- [Recognizing Action Units for Facial Expression Analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC4157835/)
- [Emotional Expressions Reconsidered](https://pmc.ncbi.nlm.nih.gov/articles/PMC6640856/)
