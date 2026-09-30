# Feeling Face

입력 중인 문장의 정서적 인상을 Jev가 실시간으로 판단하고, 핵심 6감정의 확률을 FACS(Action Unit) 기반 인물 표정으로 시각화하는 웹·macOS 앱입니다.

## 로컬 실행

Node.js 22 이상만 필요합니다. 의존성 설치는 없습니다.

```bash
npm start
```

브라우저에서 `http://localhost:4173`을 엽니다. `.env`에는 제공된 TypeSafe API 키가 저장되어 있으며 `.gitignore`에 포함됩니다. 소스 저장소나 압축 파일을 공유할 때 `.env`는 절대 포함하지 마세요.

## 동작 구조

1. 사용자가 입력하면 200ms 디바운스 후 서버에 현재 문장을 보냅니다. 새 입력이 생기면 이전 응답은 화면에 적용하지 않습니다.
2. 서버는 한 요청 안에서 Jev `Choice`로 주된 감정을, 감정별 `Noul`로 6감정과 중립의 독립 존재 확률을, `Score`로 표현 강도를 얻습니다.
3. 화면의 큰 감정명 옆 숫자는 해당 감정의 `Noul` 확률입니다. 우측 상단 숫자는 주된 감정 선택의 `Choice` 신뢰도입니다. 확률은 텍스트에서 감정 신호를 읽은 모델 판단이며 작성자의 실제 감정 측정값이 아닙니다.
4. 얼굴은 주된 감정의 전형적 표정에 나머지 확률을 일부 섞고 표현 강도를 시각적으로 확대해 눈썹·눈·코·볼·입·턱의 차이를 분명하게 보여 줍니다.
5. 동일 문장은 5분간 캐시하며 기본값으로 IP당 분당 120회까지 허용합니다. 입력 간격을 200ms로 낮추면 Jev 호출량과 비용이 증가할 수 있습니다.

## 감정 분류

- 기쁨: 원하는 결과나 좋은 관계·경험을 자신에게 이롭다고 평가하는 정서. 성취, 즐거움, 애정 어린 반가움, 안도를 포함합니다.
- 슬픔: 소중한 사람·기회·기대를 이미 잃었거나 되돌리기 어렵다고 느끼는 정서. 그리움, 허탈함, 실망을 포함합니다.
- 분노: 부당한 침해나 목표의 방해에 책임이 있다고 여기는 대상에 맞서려는 정서. 짜증과 좌절부터 격노까지 포함합니다.
- 두려움: 중요한 결과가 해를 입을 수 있다고 예상해 대비·회피하려는 정서. 현재의 공포와 불확실한 미래의 불안을 포함합니다.
- 놀람: 예상 밖 사건으로 주의가 순간 열리는 반응. 뒤이어 다른 감정으로 바뀔 수 있습니다.
- 혐오: 오염·역겨움·강한 도덕적 불쾌감을 몸과 마음에서 밀어내려는 정서입니다.

각 정의의 핵심 평가, 긍정 근거, 인접 감정과의 경계는 [public/emotions.js](./public/emotions.js)에 구조화되어 Jev의 `criteria`로 전달됩니다. 중립은 여섯 감정 중 하나를 고를 근거가 약할 때의 별도 상태입니다.

## 얼굴 모델

기본 감정의 원형 표정은 FACS Investigators' Guide에 보고된 조합을 기반으로 합니다. 예를 들어 기쁨은 AU6+12, 분노는 AU4+5+7+23/24, 두려움은 AU1+2+4+5+20+26, 놀람은 AU1+2+5+26, 슬픔은 AU1+4+15/17, 혐오는 AU9/10+17 계열입니다.

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
