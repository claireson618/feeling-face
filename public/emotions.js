// FACS describes visible actions. These seven prototypes are design targets,
// not claims that a facial configuration proves someone's inner experience.
export const emotions = {
  neutral: {
    label: "중립",
    definition: "감정 단서가 뚜렷하지 않아 특정 감정을 읽기 어려운 상태. 정보 전달이나 단순 질문처럼 사건에 대한 좋고 나쁨, 접근이나 회피 의도가 드러나지 않는다.",
    criteria: {
      appraisal: "문장의 중심이 평가보다 사실·절차·질문이다.",
      evidence: ["감정을 명시하지 않은 사실 진술", "정서적 강조가 없는 일정·방법 질문", "서로 다른 감정이 혼재하지만 우세한 정서가 없음"],
      boundary: "감정어가 없어도 성취, 상실, 위협, 침해, 오염, 예기치 못한 변화에 대한 평가가 분명하면 해당 감정을 고른다.",
    },
    aus: [{ au: "AU0", action: "휴식", muscle: "표정근의 뚜렷한 수축 없음" }],
    pose: {},
  },
  joy: {
    label: "기쁨",
    definition: "원하던 결과를 얻거나 좋은 관계·경험을 누린다고 평가할 때의 긍정적 정서. 즐거움, 성취감, 안도, 감사, 애정 어린 반가움까지 포함하며 계속 경험하거나 가까이 다가가고 싶은 마음이 나타난다.",
    criteria: {
      appraisal: "지금 또는 최근의 상황을 자신에게 이롭고 만족스럽다고 평가한다. 원하는 결과의 달성, 즐거운 경험, 관계의 따뜻함이 핵심이다.",
      evidence: ["해내서 정말 기쁘다", "함께 있어서 행복하다", "잘 끝나서 다행이고 마음이 놓인다", "보고 싶던 사람을 만나 반갑다"],
      boundary: "좋은 소식이 갑작스럽다는 사실만 중심이면 놀람, 아직 위협이 해결되지 않아 걱정이 중심이면 두려움으로 본다. 웃는 표현이 없더라도 긍정 평가가 명확하면 기쁨이다.",
    },
    aus: [
      { au: "AU6", action: "볼이 올라 눈이 초승달처럼 좁아짐", muscle: "눈둘레근의 눈확 부분" },
      { au: "AU12", action: "양쪽 입꼬리가 위와 바깥으로 올라감", muscle: "큰광대근" },
    ],
    pose: { cheekRaise: 1, smile: 1, eyeOpen: -0.44, lowerLid: 0.62, nasolabial: 0.9 },
  },
  sadness: {
    label: "슬픔",
    definition: "소중한 사람·기회·기대·관계의 상실이나 실망을 이미 일어났거나 되돌리기 어렵다고 평가할 때의 불쾌한 낮은 활력 정서. 그리움, 허탈함, 외로움, 낙담이 포함되며 물러나거나 위로를 구하고 싶어진다.",
    criteria: {
      appraisal: "이미 잃었거나 이루어지지 않은 것에 초점이 있고, 되돌리기 어렵다는 느낌과 낮은 에너지가 함께 있다.",
      evidence: ["떠난 사람이 그립다", "기대를 접고 허탈하다", "실패 후 맥이 빠지고 눈물이 난다", "혼자 남겨져 외롭다"],
      boundary: "문제를 바로잡기 위해 상대에게 항의·공격하려는 힘이 중심이면 분노다. 위험을 피하려는 긴장과 미래 걱정이 중심이면 두려움이다.",
    },
    aus: [
      { au: "AU1+4", action: "안쪽 눈썹을 올리며 가운데로 모음", muscle: "이마근 안쪽·눈썹주름근" },
      { au: "AU15", action: "입꼬리를 아래로 당김", muscle: "입꼬리내림근" },
      { au: "AU17", action: "아랫입술과 턱을 위로 밀음", muscle: "턱끝근" },
    ],
    pose: { innerBrow: 1, browDown: 0.38, frown: 1, chinRaise: 0.62, eyeOpen: -0.27, lowerLid: -0.12 },
  },
  anger: {
    label: "분노",
    definition: "목표를 막거나 경계를 침범한 원인, 특히 부당함·모욕·배신에 책임이 있다고 여기는 대상을 향한 높은 활력의 반발 정서. 좌절과 짜증부터 격노까지 포함하며 항의하거나 방해를 제거하고 싶어진다.",
    criteria: {
      appraisal: "원하지 않는 침해나 방해가 있었고, 그것이 부당하거나 누군가의 책임이라고 판단한다. 맞서기·비난·수정 요구의 방향이 있다.",
      evidence: ["이건 부당해서 화가 난다", "약속을 어긴 상대에게 따지고 싶다", "계속 막혀 짜증이 치민다", "모욕당해 참을 수 없다"],
      boundary: "위험에서 벗어나고 싶은 마음이 우세하면 두려움, 이미 잃은 것에 대한 체념이 우세하면 슬픔, 더럽거나 역겨워 멀리하고 싶으면 혐오다.",
    },
    aus: [
      { au: "AU4", action: "눈썹을 낮추고 가운데로 좁힘", muscle: "눈썹주름근·눈살근" },
      { au: "AU5+7", action: "눈을 치켜뜨되 눈꺼풀 가장자리는 조임", muscle: "윗눈꺼풀올림근·눈둘레근" },
      { au: "AU23/24", action: "입술을 단단히 조이고 맞누름", muscle: "입둘레근" },
    ],
    pose: { browDown: 1, innerBrow: -0.48, eyeOpen: 0.38, lidTight: 1, lipPress: 1, jawClench: 0.9, nostril: 0.48 },
  },
  fear: {
    label: "두려움",
    definition: "몸·관계·미래의 중요한 결과가 해를 입을 수 있다고 예상할 때의 경계 정서. 눈앞의 위협에 대한 공포부터 아직 확실하지 않은 미래에 대한 불안까지 포함하며 위험을 피하거나 대비하려는 마음이 생긴다.",
    criteria: {
      appraisal: "해로운 결과의 가능성이 핵심이고 그것을 완전히 통제할 수 없다고 느낀다. 현재의 위험이면 공포, 앞으로의 불확실한 위험이면 불안으로 이 범주에 포함한다.",
      evidence: ["갑작스러운 소리가 무서웠다", "결과가 잘못될까 봐 계속 걱정된다", "다칠까 봐 피하고 싶다", "앞으로 무슨 일이 생길지 불안하다"],
      boundary: "예상 밖 사건 자체가 핵심이고 위협 평가가 없으면 놀람이다. 막힌 목표의 원인에 맞서려는 반발이 중심이면 분노다.",
    },
    aus: [
      { au: "AU1+2+4", action: "눈썹을 높이면서 안쪽은 모음", muscle: "이마근·눈썹주름근" },
      { au: "AU5+7", action: "눈을 크게 뜨고 아래 눈꺼풀 긴장", muscle: "윗눈꺼풀올림근·눈둘레근" },
      { au: "AU20+26", action: "입을 옆으로 늘리며 턱을 내림", muscle: "입꼬리당김근·깨물근 이완" },
    ],
    pose: { innerBrow: 0.84, outerBrow: 0.73, browDown: 0.28, eyeOpen: 0.98, lowerLid: 0.46, mouthStretch: 0.86, mouthOpen: 0.66, jawDrop: 0.35 },
  },
  surprise: {
    label: "놀람",
    definition: "예상과 다른 일이 갑자기 일어나 주의가 순간적으로 크게 열리는 짧은 반응. 그 자체로 기쁘거나 두렵다는 뜻은 아니며, 뒤이어 사건을 좋거나 나쁘게 평가하면서 다른 감정으로 옮겨 갈 수 있다.",
    criteria: {
      appraisal: "기대와 실제 사건의 갑작스러운 불일치가 핵심이다. 아직 좋고 나쁨, 접근이나 회피의 방향이 분명하지 않다.",
      evidence: ["전혀 예상하지 못했다", "갑자기 나타나 깜짝 놀랐다", "믿기지 않는 소식을 들었다", "순간 말문이 막혔다"],
      boundary: "놀란 이유보다 좋은 결과의 만족이 중심이면 기쁨, 위협으로부터 피하려는 마음이 중심이면 두려움이다.",
    },
    aus: [
      { au: "AU1+2", action: "안쪽과 바깥쪽 눈썹을 함께 올림", muscle: "이마근 전체" },
      { au: "AU5", action: "윗눈꺼풀을 들어 눈을 크게 뜸", muscle: "윗눈꺼풀올림근" },
      { au: "AU26", action: "턱이 아래로 떨어져 입이 열림", muscle: "깨물근 이완" },
    ],
    pose: { innerBrow: 1, outerBrow: 1, eyeOpen: 1, mouthOpen: 1, jawDrop: 1 },
  },
  disgust: {
    label: "혐오",
    definition: "오염·악취·역겨운 맛·시각적 불쾌감이나 강한 도덕적 반감을 접해 그것을 몸과 마음에서 밀어내고 싶어지는 회피 정서. 대상에 가까이 가거나 받아들이는 일을 거부한다.",
    criteria: {
      appraisal: "대상을 몸이나 마음에 들이고 싶지 않다는 거부감이 핵심이다. 더럽다, 역겹다, 토할 것 같다는 표현이나 강한 도덕적 불쾌감이 단서다.",
      evidence: ["상한 냄새가 역겹다", "그 모습을 보니 구역질 난다", "너무 더러워 만지고 싶지 않다", "그 행동이 혐오스럽다"],
      boundary: "상대에게 책임을 묻고 바로잡으려는 분개가 중심이면 분노, 위험 때문에 도망치려는 마음이면 두려움이다. 단순히 싫다는 표현만으로 혐오를 단정하지 않는다.",
    },
    aus: [
      { au: "AU9", action: "콧등을 찡그려 주름을 만듦", muscle: "코근·윗입술콧방울올림근" },
      { au: "AU10", action: "윗입술을 올림", muscle: "윗입술올림근" },
      { au: "AU17", action: "턱을 올려 아랫입술을 밀음", muscle: "턱끝근" },
    ],
    pose: { browDown: 0.42, eyeOpen: -0.36, noseWrinkle: 1, upperLipRaise: 1, frown: 0.35, chinRaise: 0.62 },
  },
};

export const emotionOrder = Object.keys(emotions);
