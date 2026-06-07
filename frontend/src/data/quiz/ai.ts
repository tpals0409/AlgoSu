/**
 * @file AI(인공지능) 분야 CS 퀴즈 문항 (20문항)
 * @domain quiz
 * @layer data
 * @related src/data/quiz/types.ts, src/data/quiz/index.ts
 */
import { QuizCategory, type QuizQuestion } from './types';

/** AI(인공지능) 분야 단답형 문항 목록. */
export const AI_QUESTIONS: readonly QuizQuestion[] = [
  // ─── EASY (7) ─────────────────────────────────────────────────────────────
  {
    id: 'ai-01',
    category: QuizCategory.AI,
    prompt: {
      ko: '레이블이 있는 학습 데이터로 모델을 훈련해 새 입력에 대한 정답을 예측하는 학습 방식은?',
      en: 'Which learning paradigm trains a model on labeled data to predict answers for new inputs?',
    },
    acceptedAnswers: ['지도학습', '지도 학습', 'supervised learning', 'supervisedlearning'],
    explanation: {
      ko: '지도학습은 입력-정답 쌍으로 구성된 레이블 데이터로 모델을 학습시켜 새로운 입력에 대한 출력을 예측합니다.',
      en: 'Supervised learning trains a model on input-label pairs so it can predict outputs for unseen inputs.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ai-02',
    category: QuizCategory.AI,
    prompt: {
      ko: '레이블 없이 데이터의 숨겨진 구조나 패턴을 스스로 찾아내는 학습 방식은?',
      en: 'Which learning paradigm discovers hidden structure or patterns in data without labels?',
    },
    acceptedAnswers: ['비지도학습', '비지도 학습', 'unsupervised learning', 'unsupervisedlearning'],
    explanation: {
      ko: '비지도학습은 정답 레이블 없이 클러스터링이나 차원 축소 등으로 데이터의 내재된 구조를 학습합니다.',
      en: 'Unsupervised learning finds inherent structure in data—e.g. clustering or dimensionality reduction—without labels.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ai-03',
    category: QuizCategory.AI,
    prompt: {
      ko: '모델이 학습 데이터에 지나치게 맞춰져 새로운 데이터에서 성능이 떨어지는 현상은?',
      en: 'What is the phenomenon where a model fits training data too closely and performs poorly on new data?',
    },
    acceptedAnswers: ['과적합', '오버피팅', 'overfitting', 'over fitting'],
    explanation: {
      ko: '과적합(overfitting)은 모델이 훈련 세트의 노이즈까지 외워 일반화 성능이 낮아지는 문제입니다.',
      en: 'Overfitting occurs when a model memorizes training noise, resulting in poor generalization to new data.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ai-04',
    category: QuizCategory.AI,
    prompt: {
      ko: '출력층에서 여러 클래스에 대한 확률 분포를 구할 때 사용하는 활성화 함수는?',
      en: 'Which activation function converts a vector of scores into a probability distribution over multiple classes?',
    },
    acceptedAnswers: ['소프트맥스', 'softmax', 'soft max'],
    explanation: {
      ko: 'Softmax는 각 클래스의 점수를 지수 변환 후 정규화해 합이 1이 되는 확률 분포를 만듭니다.',
      en: 'Softmax exponentiates each score and normalizes them so all class probabilities sum to 1.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ai-05',
    category: QuizCategory.AI,
    prompt: {
      ko: '에폭(epoch)마다 전체 데이터셋이 아닌 무작위로 선택한 하나의 샘플로 가중치를 갱신하는 경사하강 방식은?',
      en: 'Which gradient descent variant updates weights using a single randomly selected sample per step?',
    },
    acceptedAnswers: ['확률적경사하강법', '확률적 경사 하강법', 'SGD', 'stochastic gradient descent', 'stochasticgradientdescent'],
    explanation: {
      ko: 'SGD(확률적 경사하강법)는 샘플 하나씩 가중치를 갱신해 빠르지만 노이즈가 크고 진동이 심할 수 있습니다.',
      en: 'SGD updates weights one sample at a time—fast but noisy, which can cause oscillations.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ai-06',
    category: QuizCategory.AI,
    prompt: {
      ko: '회귀 문제에서 예측값과 실제값의 차이를 제곱한 뒤 평균 낸 손실 함수는?',
      en: 'Which loss function averages the squared differences between predictions and actual values for regression?',
    },
    acceptedAnswers: ['MSE', '평균제곱오차', '평균 제곱 오차', 'mean squared error', 'meansquarederror'],
    explanation: {
      ko: 'MSE(평균 제곱 오차)는 오차를 제곱해 평균 낸 값으로, 큰 오차에 더 큰 패널티를 줍니다.',
      en: 'MSE averages squared errors, penalizing large deviations more heavily than small ones.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ai-07',
    category: QuizCategory.AI,
    prompt: {
      ko: '범주형 레이블을 각 클래스가 0 또는 1인 이진 벡터로 변환하는 인코딩 방식은?',
      en: 'Which encoding converts a categorical label into a binary vector with exactly one position set to 1?',
    },
    acceptedAnswers: ['원핫인코딩', '원-핫 인코딩', '원핫 인코딩', 'one hot encoding', 'onehotencoding', 'one-hot encoding'],
    explanation: {
      ko: '원-핫 인코딩은 클래스 수만큼의 벡터에서 해당 클래스 위치만 1, 나머지를 0으로 표현합니다.',
      en: 'One-hot encoding represents a class as a vector of zeros with a single 1 at the class index.',
    },
    difficulty: 'EASY',
  },

  // ─── MEDIUM (7) ──────────────────────────────────────────────────────────
  {
    id: 'ai-08',
    category: QuizCategory.AI,
    prompt: {
      ko: '신경망에서 출력층의 오차를 역방향으로 전파해 각 가중치의 기울기를 계산하는 알고리즘은?',
      en: 'Which algorithm propagates output error backward through a neural network to compute weight gradients?',
    },
    acceptedAnswers: ['역전파', '역전파 알고리즘', 'backpropagation', 'backprop', 'back propagation'],
    explanation: {
      ko: '역전파는 연쇄 법칙(chain rule)을 적용해 손실 함수의 기울기를 출력층에서 입력층 방향으로 전파합니다.',
      en: 'Backpropagation applies the chain rule to propagate loss gradients from the output layer back to the input layer.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ai-09',
    category: QuizCategory.AI,
    prompt: {
      ko: '음수 입력은 0으로, 양수 입력은 그대로 출력해 기울기 소실 문제를 완화하는 활성화 함수는?',
      en: 'Which activation function outputs zero for negative inputs and the identity for positive inputs, mitigating vanishing gradients?',
    },
    acceptedAnswers: ['ReLU', '렐루', 'rectified linear unit', 'rectifiedlinearunit'],
    explanation: {
      ko: 'ReLU(Rectified Linear Unit)는 max(0, x)로 정의되며 기울기 소실을 줄여 딥러닝에서 널리 사용됩니다.',
      en: 'ReLU is defined as max(0, x), reducing vanishing gradients and enabling efficient deep network training.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ai-10',
    category: QuizCategory.AI,
    prompt: {
      ko: '이미지 특징 추출에 특화된, 합성곱 연산을 핵심으로 하는 신경망 구조는?',
      en: 'Which neural network architecture specializes in image feature extraction using convolution operations?',
    },
    acceptedAnswers: ['CNN', '합성곱신경망', '합성곱 신경망', 'convolutional neural network', 'convolutionalneuralnetwork'],
    explanation: {
      ko: 'CNN(합성곱 신경망)은 합성곱 필터로 공간적 특징을 추출하고 풀링으로 크기를 줄여 이미지 분류에 강합니다.',
      en: 'CNNs extract spatial features with convolutional filters and reduce dimensionality with pooling, excelling at image tasks.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ai-11',
    category: QuizCategory.AI,
    prompt: {
      ko: '순서가 있는 시퀀스 데이터를 처리하기 위해 이전 은닉 상태를 재귀적으로 활용하는 신경망은?',
      en: 'Which neural network processes sequential data by recursively feeding the previous hidden state into each step?',
    },
    acceptedAnswers: ['RNN', '순환신경망', '순환 신경망', 'recurrent neural network', 'recurrentneuralnetwork'],
    explanation: {
      ko: 'RNN(순환 신경망)은 이전 타임스텝의 은닉 상태를 현재 입력과 함께 처리해 순서 정보를 반영합니다.',
      en: 'RNN feeds each step\'s hidden state to the next, capturing sequential dependencies in time-series or text data.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ai-12',
    category: QuizCategory.AI,
    prompt: {
      ko: '훈련 중 무작위로 뉴런 일부를 비활성화해 과적합을 방지하는 정규화 기법은?',
      en: 'Which regularization technique randomly deactivates a fraction of neurons during training to prevent overfitting?',
    },
    acceptedAnswers: ['드롭아웃', 'dropout', 'drop out'],
    explanation: {
      ko: '드롭아웃은 훈련 시 무작위로 일부 뉴런을 0으로 만들어 앙상블 효과를 내고 과적합을 억제합니다.',
      en: 'Dropout randomly zeros out neurons during training, creating an ensemble effect that reduces overfitting.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ai-13',
    category: QuizCategory.AI,
    prompt: {
      ko: 'K개 클러스터 중심을 반복 갱신하며 데이터를 군집화하는 비지도학습 알고리즘은?',
      en: 'Which unsupervised clustering algorithm iteratively updates K cluster centroids to group data points?',
    },
    acceptedAnswers: ['K-means', 'k means', 'kmeans', 'k-평균', 'k 평균', 'k평균'],
    explanation: {
      ko: 'K-means는 각 데이터를 가장 가까운 중심에 할당하고 중심을 재계산하는 과정을 수렴할 때까지 반복합니다.',
      en: 'K-means assigns each point to its nearest centroid and recomputes centroids, repeating until convergence.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ai-14',
    category: QuizCategory.AI,
    prompt: {
      ko: '고차원 데이터를 분산이 최대인 방향의 축으로 투영해 차원을 줄이는 선형 기법은?',
      en: 'Which linear technique reduces dimensionality by projecting data onto axes that maximize variance?',
    },
    acceptedAnswers: ['PCA', '주성분분석', '주성분 분석', 'principal component analysis', 'principalcomponentanalysis'],
    explanation: {
      ko: 'PCA(주성분 분석)는 공분산 행렬의 고유벡터를 이용해 데이터 분산이 가장 큰 축으로 투영합니다.',
      en: 'PCA uses eigenvectors of the covariance matrix to project data onto directions of maximum variance.',
    },
    difficulty: 'MEDIUM',
  },

  // ─── HARD (6) ────────────────────────────────────────────────────────────
  {
    id: 'ai-15',
    category: QuizCategory.AI,
    prompt: {
      ko: '쿼리(Query), 키(Key), 값(Value) 세 벡터를 사용해 각 토큰 간 관련성을 가중 합산하는 트랜스포머의 핵심 메커니즘은?',
      en: 'Which core Transformer mechanism computes a weighted sum of values by scoring each token pair using Query and Key vectors?',
    },
    acceptedAnswers: ['어텐션', '셀프어텐션', '셀프 어텐션', 'self attention', 'selfattention', 'attention', 'scaled dot product attention'],
    explanation: {
      ko: 'Attention은 쿼리와 키의 내적 점수로 각 값에 가중치를 두어 문맥 관계를 동적으로 포착합니다.',
      en: 'Attention scores token pairs via Query-Key dot products and takes a weighted sum of Values, capturing dynamic context.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ai-16',
    category: QuizCategory.AI,
    prompt: {
      ko: 'RNN의 장기 의존성 문제를 입력·망각·출력 게이트로 완화한 순환 신경망 변형은?',
      en: 'Which RNN variant uses input, forget, and output gates to mitigate long-term dependency problems?',
    },
    acceptedAnswers: ['LSTM', '장단기메모리', '장단기 메모리', 'long short term memory', 'longshorttermemory'],
    explanation: {
      ko: 'LSTM은 셀 상태와 세 게이트(입력·망각·출력)로 기울기 소실 없이 장기 의존성을 학습합니다.',
      en: 'LSTM uses a cell state and three gates to selectively retain or discard information, learning long-range dependencies.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ai-17',
    category: QuizCategory.AI,
    prompt: {
      ko: '생성자(Generator)와 판별자(Discriminator)가 경쟁하며 학습해 현실적인 데이터를 생성하는 모델은?',
      en: 'Which generative model trains a Generator and Discriminator adversarially to produce realistic synthetic data?',
    },
    acceptedAnswers: ['GAN', '생성적적대신경망', '생성 적대 신경망', 'generative adversarial network', 'generativeadversarialnetwork'],
    explanation: {
      ko: 'GAN은 생성자가 가짜 데이터를 만들고 판별자가 진위를 구분하는 적대적 학습으로 고품질 생성 모델을 만듭니다.',
      en: 'GAN pits a Generator against a Discriminator; adversarial training pushes the Generator to produce increasingly realistic data.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ai-18',
    category: QuizCategory.AI,
    prompt: {
      ko: '대규모 데이터로 사전 학습된 모델의 가중치를 새로운 관련 과제에 재활용해 학습하는 기법은?',
      en: 'Which technique reuses weights from a model pretrained on large data and adapts them to a new related task?',
    },
    acceptedAnswers: ['전이학습', '전이 학습', 'transfer learning', 'transferlearning'],
    explanation: {
      ko: '전이학습은 사전 학습된 특징 표현을 목표 과제에 미세조정(fine-tuning)해 적은 데이터로도 높은 성능을 냅니다.',
      en: 'Transfer learning fine-tunes pretrained feature representations on a target task, achieving strong performance with less data.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ai-19',
    category: QuizCategory.AI,
    prompt: {
      ko: '모델의 분산(variance)을 낮추려 하면 편향(bias)이 커지고, 편향을 낮추면 분산이 커지는 딜레마를 가리키는 용어는?',
      en: 'What term describes the dilemma where reducing model variance increases bias and vice versa?',
    },
    acceptedAnswers: ['편향분산트레이드오프', '편향 분산 트레이드오프', '바이어스-분산 트레이드오프', 'bias variance tradeoff', 'biasvariance tradeoff', 'bias-variance tradeoff'],
    explanation: {
      ko: '편향-분산 트레이드오프는 과소적합(고편향)과 과적합(고분산) 사이에서 최적 복잡도를 찾아야 함을 의미합니다.',
      en: 'The bias-variance tradeoff means reducing underfitting (high bias) risks overfitting (high variance), requiring an optimal model complexity.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ai-20',
    category: QuizCategory.AI,
    prompt: {
      ko: '분류 모델 평가에서 정밀도(Precision)와 재현율(Recall)의 조화 평균으로 계산되는 지표는?',
      en: 'Which classification metric is the harmonic mean of Precision and Recall?',
    },
    acceptedAnswers: ['F1', 'F1점수', 'F1 점수', 'F1 score', 'F1score', 'f1'],
    explanation: {
      ko: 'F1 점수는 2×(정밀도×재현율)/(정밀도+재현율)로, 클래스 불균형 상황에서 정확도보다 신뢰성 있는 지표입니다.',
      en: 'F1 score = 2×(Precision×Recall)/(Precision+Recall), a reliable metric under class imbalance.',
    },
    difficulty: 'HARD',
  },
];
