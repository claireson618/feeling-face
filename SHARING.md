# GitHub Pages + Render 배포

친구에게 공유할 주소는 `https://claireson618.github.io/feeling-face/`입니다. GitHub Pages는 화면만 배포하고, Jev 요청은 Render의 Node 서버가 처리합니다. 공개 GitHub 저장소에는 코드가 보이지만 TypeSafe API 키와 친구 접근 코드는 포함되지 않습니다.

## Render 백엔드

1. Render에서 GitHub의 `claireson618/feeling-face` 저장소를 연결해 Web Service를 만듭니다. Node 런타임, `npm run check` 빌드 명령, `npm start` 시작 명령을 사용합니다. 가능하면 Free 플랜을 선택하고, 유료 플랜은 확인 후 결정합니다.
2. 아래 환경 변수를 Render 서비스에만 설정합니다. `.env` 파일을 업로드하거나 Git에 커밋하지 않습니다.

| 이름 | 값 |
| --- | --- |
| `TYPESAFE_API_KEY` | TypeSafe에서 받은 개인 API 키 |
| `FRIEND_ACCESS_TOKEN` | 친구에게 별도로 알려 줄 임의의 긴 접근 코드 |
| `ALLOWED_ORIGIN` | `https://claireson618.github.io` |
| `MAX_DAILY_JEV_CALLS` | 처음에는 `300` 권장 |
| `REQUESTS_PER_MINUTE` | 처음에는 `30` 권장 |

Render는 `PORT`와 `RENDER`를 자동으로 설정합니다. 서버는 Render 환경에서 `0.0.0.0`에 바인딩하며, 필수 비밀값이 빠지면 시작하지 않습니다. 하루 호출 제한은 서버 메모리 기반이라 재시작 시 초기화됩니다. 비용 상한을 엄격하게 보장하지 않으므로 TypeSafe 계정 측 사용량도 확인해야 합니다.

## GitHub Pages 프런트엔드

1. GitHub 저장소의 Settings → Pages에서 Source를 **GitHub Actions**로 설정합니다.
2. Settings → Secrets and variables → Actions → Variables에 `RENDER_API_BASE_URL`을 만들고 Render 서비스의 HTTPS origin(예: `https://feeling-face-api.onrender.com`)을 넣습니다. URL은 공개 설정이며 API 키가 아닙니다.
3. Actions 탭에서 `Deploy GitHub Pages` 작업을 실행합니다. 이후 `main`에 푸시하면 자동 재배포됩니다.

배포 스크립트는 정적 파일만 `site/`에 복사하고 Render 주소를 `config.js`에 기록합니다. GitHub 저장소와 Pages 산출물에 API 키 또는 접근 코드를 넣지 마세요.

## 친구에게 보내기

사이트 주소와 친구 접근 코드를 서로 다른 메시지로 전달합니다. 친구는 웹사이트의 코드 입력창에 한 번 입력하면 해당 탭에서만 분석 기능을 사용할 수 있습니다. **이 코드는 사용자별 계정이 아닌 공유 비밀값**이므로 유출되면 Render에서 `FRIEND_ACCESS_TOKEN`을 교체해야 합니다. 사이트 자체는 공개로 열립니다.

입력한 문장은 친구의 브라우저 → Render → TypeSafe로 전송됩니다. 민감한 개인정보는 입력하지 않도록 안내하세요. 무료 Render 서비스는 유휴 후 재시작으로 첫 요청이 느려질 수 있으며, 서비스 요금과 TypeSafe 호출 비용은 각각 별개입니다.

## 맥 앱

이 프로젝트에는 WebKit 기반 `Feeling Face.app`도 있습니다. 이 Mac에서 직접 실행하며 앱 내부의 로컬 서버가 무작위 포트를 사용합니다. API 키는 앱 바깥의 `~/Library/Application Support/Feeling Face/.env`에 둡니다. 빌드 소스는 `macos/`에 있습니다.
