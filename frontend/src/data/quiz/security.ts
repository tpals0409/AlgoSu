/**
 * @file 보안(Security) 분야 CS 퀴즈 문항 (20문항)
 * @domain quiz
 * @layer data
 * @related src/data/quiz/types.ts, src/data/quiz/index.ts
 */
import { QuizCategory, type QuizQuestion } from './types';

/** 보안(Security) 분야 단답형 문항 목록. */
export const SECURITY_QUESTIONS: readonly QuizQuestion[] = [
  // ── EASY (7) ────────────────────────────────────────────────────────────────
  {
    id: 'sec-01',
    category: QuizCategory.SECURITY,
    prompt: {
      ko: '기밀성(Confidentiality)·무결성(Integrity)·가용성(Availability) 세 가지 보안 목표를 통칭하는 약어는?',
      en: 'What acronym collectively refers to the three security goals: Confidentiality, Integrity, and Availability?',
    },
    acceptedAnswers: ['CIA', 'CIA 삼요소', 'cia triad', 'cia 트라이어드'],
    explanation: {
      ko: 'CIA 삼요소는 정보 보안의 세 가지 핵심 목표—기밀성, 무결성, 가용성—를 나타내는 보안 원칙의 기본 틀입니다.',
      en: 'The CIA triad is the foundational framework of information security, representing Confidentiality, Integrity, and Availability.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'sec-02',
    category: QuizCategory.SECURITY,
    prompt: {
      ko: '사용자가 누구인지 확인하는 절차를 무엇이라 하는가? (인증 vs 인가 중)',
      en: 'What is the process of verifying who a user is called? (authentication vs authorization)',
    },
    acceptedAnswers: ['인증', 'authentication', 'authn'],
    explanation: {
      ko: '인증(Authentication)은 신원을 확인하는 절차이며, 인가(Authorization)는 확인된 신원에 대해 권한을 부여하는 절차입니다.',
      en: 'Authentication verifies who a user is, while authorization determines what an authenticated user is allowed to do.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'sec-03',
    category: QuizCategory.SECURITY,
    prompt: {
      ko: '웹 폼이나 URL 파라미터를 통해 악성 SQL 구문을 삽입하여 DB를 공격하는 취약점은?',
      en: 'What vulnerability involves injecting malicious SQL statements through form inputs or URL parameters to attack a database?',
    },
    acceptedAnswers: ['SQL 인젝션', 'sql injection', 'sqli', 'SQL 삽입'],
    explanation: {
      ko: 'SQL 인젝션은 입력값을 적절히 검증하지 않아 악성 SQL이 실행되는 취약점으로, 파라미터 바인딩으로 방어합니다.',
      en: 'SQL injection exploits insufficient input validation to execute malicious SQL; it is prevented by using parameterized queries.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'sec-04',
    category: QuizCategory.SECURITY,
    prompt: {
      ko: '동일한 입력에 항상 같은 고정 길이 출력을 내고, 역방향 복원이 불가능한 단방향 함수를 무엇이라 하는가?',
      en: 'What is a one-way function that always produces a fixed-length output for the same input and cannot be reversed called?',
    },
    acceptedAnswers: ['해시함수', 'hash function', '해시', 'hash', '해시 함수'],
    explanation: {
      ko: '해시 함수는 임의 길이 입력을 고정 길이 다이제스트로 변환하며 단방향성(역방향 불가)과 충돌 저항성이 핵심 특성입니다.',
      en: 'A hash function maps arbitrary input to a fixed-length digest and is characterized by one-wayness and collision resistance.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'sec-05',
    category: QuizCategory.SECURITY,
    prompt: {
      ko: '비밀번호 해싱 시 레인보우 테이블 공격을 막기 위해 해시 전에 추가하는 임의의 데이터를 무엇이라 하는가?',
      en: 'What is the random data added to a password before hashing to defend against rainbow table attacks called?',
    },
    acceptedAnswers: ['솔트', 'salt', '솔팅', 'salting'],
    explanation: {
      ko: '솔트(Salt)는 사용자마다 다른 임의 값을 비밀번호에 추가함으로써 동일 비밀번호라도 다른 해시값을 생성해 레인보우 테이블을 무력화합니다.',
      en: 'A salt is a random value added to each password before hashing, ensuring identical passwords produce different hashes and defeating rainbow table lookups.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'sec-06',
    category: QuizCategory.SECURITY,
    prompt: {
      ko: '공격자가 다량의 봇넷을 이용해 대상 서버에 폭발적인 트래픽을 보내 서비스를 마비시키는 공격 유형은?',
      en: 'What attack type uses a botnet to flood a target server with massive traffic, overwhelming and disabling the service?',
    },
    acceptedAnswers: ['DDoS', '디도스', 'distributed denial of service', '분산서비스거부', '분산 서비스 거부'],
    explanation: {
      ko: 'DDoS(분산 서비스 거부) 공격은 다수의 감염된 호스트로 트래픽을 집중시켜 가용성(A)을 침해합니다.',
      en: 'A DDoS (Distributed Denial of Service) attack uses many compromised hosts to flood a target, violating the Availability aspect of the CIA triad.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'sec-07',
    category: QuizCategory.SECURITY,
    prompt: {
      ko: 'HTTP 통신을 TLS로 암호화한 프로토콜의 약어는?',
      en: 'What is the abbreviation for the protocol that encrypts HTTP communication with TLS?',
    },
    acceptedAnswers: ['HTTPS', 'https', 'hypertext transfer protocol secure'],
    explanation: {
      ko: 'HTTPS는 HTTP에 TLS(Transport Layer Security) 암호화를 적용하여 데이터 기밀성·무결성 및 서버 인증을 제공합니다.',
      en: 'HTTPS applies TLS encryption to HTTP, providing data confidentiality, integrity, and server authentication.',
    },
    difficulty: 'EASY',
  },

  // ── MEDIUM (7) ───────────────────────────────────────────────────────────────
  {
    id: 'sec-08',
    category: QuizCategory.SECURITY,
    prompt: {
      ko: '암호화와 복호화에 동일한 키를 사용하는 암호화 방식은?',
      en: 'What type of encryption uses the same key for both encryption and decryption?',
    },
    acceptedAnswers: ['대칭키 암호화', '대칭키', 'symmetric encryption', 'symmetric key encryption', 'symmetric cryptography', '대칭 암호화'],
    explanation: {
      ko: '대칭키 암호화는 동일 키로 암호화·복호화하므로 속도가 빠르나, 키 배분 문제가 존재합니다. AES가 대표적입니다.',
      en: 'Symmetric key encryption uses the same key for encryption and decryption, making it fast but requiring secure key distribution. AES is a prime example.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'sec-09',
    category: QuizCategory.SECURITY,
    prompt: {
      ko: '공개키로 암호화하고 개인키로 복호화하는, 키 쌍을 사용하는 암호화 방식은?',
      en: 'What encryption scheme uses a key pair where data encrypted with the public key can only be decrypted with the private key?',
    },
    acceptedAnswers: ['비대칭키 암호화', '비대칭키', 'asymmetric encryption', 'asymmetric key encryption', 'public key encryption', '공개키 암호화', '공개키암호화'],
    explanation: {
      ko: '비대칭키(공개키) 암호화는 공개키·개인키 쌍을 사용하며, 키 배분 문제를 해결하지만 대칭키보다 속도가 느립니다. RSA가 대표적입니다.',
      en: 'Asymmetric (public-key) encryption uses a key pair to solve key distribution problems, though it is slower than symmetric encryption. RSA is a well-known example.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'sec-10',
    category: QuizCategory.SECURITY,
    prompt: {
      ko: '발신자가 개인키로 서명하고 수신자가 공개키로 서명을 검증해 위·변조 여부를 확인하는 메커니즘은?',
      en: 'What mechanism has a sender sign with a private key and a receiver verify the signature with a public key to detect tampering?',
    },
    acceptedAnswers: ['디지털 서명', 'digital signature', '전자서명'],
    explanation: {
      ko: '디지털 서명은 문서의 해시를 개인키로 암호화하여 생성하며, 공개키로 검증해 무결성과 부인 방지를 보장합니다.',
      en: 'A digital signature encrypts a document\'s hash with a private key; verifying it with the public key ensures integrity and non-repudiation.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'sec-11',
    category: QuizCategory.SECURITY,
    prompt: {
      ko: '공격자가 로그인된 사용자 브라우저를 이용해 사용자 모르게 악성 요청을 전송하는 웹 공격은?',
      en: 'What web attack exploits an authenticated user\'s browser to send malicious requests without the user\'s knowledge?',
    },
    acceptedAnswers: ['CSRF', '사이트 간 요청 위조', 'cross site request forgery', 'cross-site request forgery', '크로스사이트요청위조'],
    explanation: {
      ko: 'CSRF는 인증된 세션을 악용해 사용자 의도 없는 요청을 전송하며, CSRF 토큰·SameSite 쿠키로 방어합니다.',
      en: 'CSRF abuses an authenticated session to send unintended requests; CSRF tokens and SameSite cookies are primary defenses.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'sec-12',
    category: QuizCategory.SECURITY,
    prompt: {
      ko: 'JWT(JSON Web Token)는 Header·Payload·___의 세 부분으로 구성된다. 빈칸을 채우시오.',
      en: 'A JWT (JSON Web Token) consists of three parts: Header, Payload, and ___. Fill in the blank.',
    },
    acceptedAnswers: ['Signature', '서명', 'signature'],
    explanation: {
      ko: 'JWT는 Base64URL 인코딩된 Header.Payload.Signature 형식이며, Signature는 토큰 위·변조를 검증하는 데 사용됩니다.',
      en: 'A JWT is formatted as Base64URL-encoded Header.Payload.Signature, where the Signature is used to verify that the token has not been tampered with.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'sec-13',
    category: QuizCategory.SECURITY,
    prompt: {
      ko: '비밀번호만이 아닌 OTP·생체 인식 등 두 가지 이상의 인증 수단을 요구하는 방식은?',
      en: 'What authentication method requires two or more verification factors—such as a password plus OTP or biometrics?',
    },
    acceptedAnswers: ['MFA', '다중인증', 'multi factor authentication', 'multi-factor authentication', '2FA', '이중인증', 'two factor authentication', 'two-factor authentication'],
    explanation: {
      ko: 'MFA(Multi-Factor Authentication)는 지식(비밀번호)·소유(OTP)·생체 인식 등 복수 요소를 조합해 단일 요소 탈취의 위험을 크게 낮춥니다.',
      en: 'MFA (Multi-Factor Authentication) combines multiple factors—knowledge, possession, and inherence—to significantly reduce the risk of a single compromised factor.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'sec-14',
    category: QuizCategory.SECURITY,
    prompt: {
      ko: '브라우저에 첫 HTTPS 접속 후 이후 요청은 항상 HTTPS로만 연결하도록 강제하는 HTTP 응답 헤더는?',
      en: 'Which HTTP response header instructs the browser to only use HTTPS for all future requests after the first connection?',
    },
    acceptedAnswers: ['HSTS', 'strict transport security', 'http strict transport security', 'HTTP Strict Transport Security'],
    explanation: {
      ko: 'HSTS(HTTP Strict Transport Security)는 `Strict-Transport-Security` 헤더로 지정 기간 동안 HTTP 다운그레이드를 차단합니다.',
      en: 'HSTS (HTTP Strict Transport Security) uses the `Strict-Transport-Security` header to prevent HTTP downgrade attacks for a specified duration.',
    },
    difficulty: 'MEDIUM',
  },

  // ── HARD (6) ────────────────────────────────────────────────────────────────
  {
    id: 'sec-15',
    category: QuizCategory.SECURITY,
    prompt: {
      ko: 'TLS 핸드셰이크 중 클라이언트·서버가 실제 세션 키를 파생시키기 위해 공유하는 값으로, 서버 공개키 또는 DH로 보호되는 것은?',
      en: 'During a TLS handshake, what shared value protected by the server\'s public key or Diffie-Hellman is used to derive the actual session key?',
    },
    acceptedAnswers: ['pre-master secret', 'premaster secret', '프리마스터 시크릿', 'pre master secret'],
    explanation: {
      ko: 'Pre-Master Secret은 TLS 핸드셰이크에서 클라이언트가 생성하고 서버 공개키(RSA) 또는 DH 교환으로 공유하며, 이를 바탕으로 Master Secret → 세션 키가 파생됩니다.',
      en: 'The Pre-Master Secret is generated by the client during a TLS handshake and shared via the server\'s RSA public key or Diffie-Hellman exchange, from which the Master Secret and session keys are derived.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'sec-16',
    category: QuizCategory.SECURITY,
    prompt: {
      ko: '공격자가 악성 스크립트를 DB에 저장해 다른 사용자가 해당 페이지를 열 때 실행되는 XSS 유형은?',
      en: 'What XSS type stores a malicious script in the database so it executes whenever another user loads the affected page?',
    },
    acceptedAnswers: ['Stored XSS', '저장형 XSS', 'persistent XSS', 'stored cross-site scripting', '저장형 크로스사이트스크립팅'],
    explanation: {
      ko: 'Stored XSS(저장형 XSS)는 악성 스크립트가 서버에 영속 저장되어 피해 범위가 크며, Reflected·DOM XSS와 달리 별도 피싱 링크가 필요 없습니다.',
      en: 'Stored XSS persists the malicious script on the server, affecting all users who load the page without requiring a separate phishing link unlike Reflected or DOM XSS.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'sec-17',
    category: QuizCategory.SECURITY,
    prompt: {
      ko: '공인된 CA가 서명한 디지털 인증서를 중심으로 공개키의 신뢰성을 관리하는 체계를 무엇이라 하는가?',
      en: 'What system manages the trustworthiness of public keys through digital certificates signed by accredited Certificate Authorities?',
    },
    acceptedAnswers: ['PKI', '공개키 기반구조', 'public key infrastructure', '공개키기반구조'],
    explanation: {
      ko: 'PKI(Public Key Infrastructure)는 CA, 인증서, CRL/OCSP로 구성되며 공개키의 소유자를 검증·신뢰하는 기반 체계입니다.',
      en: 'PKI (Public Key Infrastructure) consists of CAs, certificates, and CRL/OCSP to verify and trust the owner of a public key.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'sec-18',
    category: QuizCategory.SECURITY,
    prompt: {
      ko: '비밀번호 해싱에서 레인보우 테이블과 단순 딕셔너리 공격을 모두 막기 위해 비용 파라미터(cost factor)로 연산 횟수를 조절하는 적응형 해시 알고리즘은?',
      en: 'Which adaptive hashing algorithm for passwords uses a cost factor to control computation rounds, defending against both rainbow tables and dictionary attacks?',
    },
    acceptedAnswers: ['bcrypt', '비크립트'],
    explanation: {
      ko: 'bcrypt는 내부에 솔트를 포함하며 비용 파라미터(cost factor)로 해시 연산 횟수를 지수적으로 증가시켜 GPU 병렬 공격을 방어합니다.',
      en: 'bcrypt embeds a salt and uses a cost factor to exponentially increase computation rounds, making GPU-parallel brute-force attacks prohibitively expensive.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'sec-19',
    category: QuizCategory.SECURITY,
    prompt: {
      ko: '내부망도 포함해 모든 접근 요청을 기본으로 신뢰하지 않고 지속적으로 검증하는 현대 보안 모델은?',
      en: 'What modern security model trusts no request by default—including those from internal networks—and requires continuous verification?',
    },
    acceptedAnswers: ['제로트러스트', 'zero trust', 'zero-trust', '제로 트러스트', 'zero trust model', 'zero trust architecture', 'ZTA'],
    explanation: {
      ko: '제로 트러스트(Zero Trust)는 "절대 신뢰하지 말고 항상 검증하라"는 원칙으로, 네트워크 경계 모델의 내부 신뢰 가정을 완전히 제거합니다.',
      en: 'Zero Trust operates on "never trust, always verify," eliminating the implicit internal trust assumption of traditional perimeter-based security models.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'sec-20',
    category: QuizCategory.SECURITY,
    prompt: {
      ko: '제3자 서비스가 사용자 비밀번호를 직접 받지 않고 액세스 토큰을 통해 한정된 리소스 접근 권한을 위임받는 인가 프레임워크는?',
      en: 'Which authorization framework allows a third-party service to obtain limited resource access via access tokens without ever receiving the user\'s password?',
    },
    acceptedAnswers: ['OAuth 2.0', 'oauth2', 'oauth 2', 'OAuth', 'oauth'],
    explanation: {
      ko: 'OAuth 2.0은 리소스 소유자 대신 클라이언트가 액세스 토큰을 발급받아 범위가 제한된 리소스 접근을 위임받는 인가 프레임워크입니다.',
      en: 'OAuth 2.0 is an authorization framework where a client obtains access tokens on behalf of a resource owner to access resources with a limited, delegated scope.',
    },
    difficulty: 'HARD',
  },
];
