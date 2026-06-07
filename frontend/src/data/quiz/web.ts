/**
 * @file 웹/HTTP(Web) 분야 CS 퀴즈 문항 (20문항)
 * @domain quiz
 * @layer data
 * @related src/data/quiz/types.ts, src/data/quiz/index.ts
 */
import { QuizCategory, type QuizQuestion } from './types';

/** 웹/HTTP(Web) 분야 단답형 문항 목록. */
export const WEB_QUESTIONS: readonly QuizQuestion[] = [
  // ── EASY (7문항) ──────────────────────────────────────────
  {
    id: 'web-01',
    category: QuizCategory.WEB,
    prompt: {
      ko: '서버에서 데이터를 조회(읽기)할 때 사용하는 HTTP 메서드는?',
      en: 'Which HTTP method is used to retrieve (read) data from a server?',
    },
    acceptedAnswers: ['GET', 'get'],
    explanation: {
      ko: 'GET은 서버 상태를 변경하지 않는 안전(safe)하고 멱등(idempotent)한 읽기 전용 메서드입니다.',
      en: 'GET is a safe and idempotent read-only method that does not modify server state.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'web-02',
    category: QuizCategory.WEB,
    prompt: {
      ko: 'HTTP 상태코드 404가 나타내는 의미는?',
      en: 'What does HTTP status code 404 indicate?',
    },
    acceptedAnswers: ['404', 'not found', 'not-found', '찾을 수 없음', '리소스 없음'],
    explanation: {
      ko: '404 Not Found는 요청한 리소스가 서버에 존재하지 않음을 나타냅니다.',
      en: '404 Not Found means the requested resource does not exist on the server.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'web-03',
    category: QuizCategory.WEB,
    prompt: {
      ko: 'HTTP 통신에서 데이터를 암호화하기 위해 TLS/SSL을 적용한 프로토콜은?',
      en: 'Which protocol applies TLS/SSL to encrypt HTTP communication?',
    },
    acceptedAnswers: ['HTTPS', 'https'],
    explanation: {
      ko: 'HTTPS는 HTTP에 TLS(SSL)를 결합해 전송 데이터를 암호화하고 서버 신원을 검증합니다.',
      en: 'HTTPS combines HTTP with TLS to encrypt transmitted data and verify server identity.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'web-04',
    category: QuizCategory.WEB,
    prompt: {
      ko: '서버가 요청을 성공적으로 처리했음을 나타내는 HTTP 상태코드는?',
      en: 'Which HTTP status code indicates the server successfully processed the request?',
    },
    acceptedAnswers: ['200', 'ok', '200 ok'],
    explanation: {
      ko: '200 OK는 요청이 성공적으로 처리되었음을 나타내는 가장 기본적인 성공 상태코드입니다.',
      en: '200 OK is the most fundamental success status code, indicating the request was processed successfully.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'web-05',
    category: QuizCategory.WEB,
    prompt: {
      ko: '브라우저에 저장되며 매 HTTP 요청에 자동으로 포함되는 작은 데이터 조각은?',
      en: 'What small piece of data is stored in the browser and automatically included in every HTTP request?',
    },
    acceptedAnswers: ['쿠키', 'cookie', 'cookies'],
    explanation: {
      ko: '쿠키(Cookie)는 서버가 Set-Cookie 헤더로 설정하며 이후 요청마다 Cookie 헤더에 자동 포함됩니다.',
      en: 'Cookies are set by the server via the Set-Cookie header and automatically sent in subsequent requests via the Cookie header.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'web-06',
    category: QuizCategory.WEB,
    prompt: {
      ko: 'HTTP의 핵심 특성으로, 서버가 이전 요청 상태를 저장하지 않는 성질을 무엇이라 하는가?',
      en: 'What is the core HTTP characteristic where the server does not store the state of previous requests?',
    },
    acceptedAnswers: ['무상태', 'stateless', 'statelessness', '비상태'],
    explanation: {
      ko: 'HTTP는 무상태(stateless) 프로토콜이므로 각 요청은 독립적이며 서버는 이전 요청 정보를 기억하지 않습니다.',
      en: 'HTTP is a stateless protocol; each request is independent and the server retains no memory of prior requests.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'web-07',
    category: QuizCategory.WEB,
    prompt: {
      ko: 'DNS가 변환하는 대상은? (예: www.example.com → ?)',
      en: 'What does DNS translate a domain name into? (e.g. www.example.com → ?)',
    },
    acceptedAnswers: ['IP 주소', 'IP', 'ip address', 'ip주소', 'ip 어드레스'],
    explanation: {
      ko: 'DNS(도메인 네임 시스템)는 사람이 읽을 수 있는 도메인을 컴퓨터가 사용하는 IP 주소로 변환합니다.',
      en: 'DNS (Domain Name System) translates human-readable domain names into IP addresses used by computers.',
    },
    difficulty: 'EASY',
  },
  // ── MEDIUM (7문항) ─────────────────────────────────────────
  {
    id: 'web-08',
    category: QuizCategory.WEB,
    prompt: {
      ko: '다른 출처(origin)의 자원을 브라우저에서 요청할 수 있도록 서버가 허용하는 메커니즘은?',
      en: 'What mechanism allows a server to permit browser requests to resources from a different origin?',
    },
    acceptedAnswers: ['CORS', 'cors', '교차 출처 리소스 공유', 'cross origin resource sharing', 'cross-origin resource sharing'],
    explanation: {
      ko: 'CORS(Cross-Origin Resource Sharing)는 서버가 특정 헤더로 허용 출처를 명시해 SOP를 완화하는 표준입니다.',
      en: 'CORS (Cross-Origin Resource Sharing) is a standard where the server uses specific headers to relax the Same-Origin Policy for permitted origins.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'web-09',
    category: QuizCategory.WEB,
    prompt: {
      ko: '리소스가 변경되지 않았을 때 서버가 반환하는 HTTP 상태코드는? (조건부 요청 캐시 히트)',
      en: 'Which HTTP status code does the server return when the resource has not changed? (conditional request cache hit)',
    },
    acceptedAnswers: ['304', 'not modified', '304 not modified'],
    explanation: {
      ko: '304 Not Modified는 클라이언트 캐시가 최신임을 알려주며 응답 본문 없이 캐시된 버전을 재사용하도록 합니다.',
      en: '304 Not Modified tells the client its cache is up-to-date; no body is sent and the cached version is reused.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'web-10',
    category: QuizCategory.WEB,
    prompt: {
      ko: '같은 URL로 여러 번 요청해도 결과가 동일한 HTTP 메서드 성질을 무엇이라 하는가?',
      en: 'What property describes an HTTP method where making the same request multiple times yields the same result?',
    },
    acceptedAnswers: ['멱등성', '멱등', 'idempotent', 'idempotency', 'idempotence'],
    explanation: {
      ko: '멱등성(idempotency)은 동일 요청을 여러 번 보내도 서버 상태가 처음 한 번과 같은 결과를 유지하는 성질로, GET·PUT·DELETE가 멱등하며 POST는 아닙니다.',
      en: 'Idempotency means that making identical requests multiple times leaves the server state the same as after the first; GET, PUT, DELETE are idempotent while POST is not.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'web-11',
    category: QuizCategory.WEB,
    prompt: {
      ko: 'JSON 기반 선언적 쿼리 언어로, 클라이언트가 필요한 데이터 구조를 직접 지정해 over-fetching을 방지하는 API 기술은?',
      en: 'Which JSON-based declarative query language lets clients specify the exact data structure they need, preventing over-fetching?',
    },
    acceptedAnswers: ['GraphQL', 'graphql', 'graph ql'],
    explanation: {
      ko: 'GraphQL은 클라이언트가 필요한 필드만 요청할 수 있어 over-fetching·under-fetching을 줄이며, 단일 엔드포인트를 사용합니다.',
      en: 'GraphQL lets clients request only the fields they need, reducing over-fetching and under-fetching, and uses a single endpoint.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'web-12',
    category: QuizCategory.WEB,
    prompt: {
      ko: 'HTTP/2에서 하나의 TCP 연결 위에서 여러 요청/응답을 동시에 처리하는 기능은?',
      en: 'What HTTP/2 feature allows multiple requests and responses to be processed simultaneously over a single TCP connection?',
    },
    acceptedAnswers: ['멀티플렉싱', 'multiplexing', 'stream multiplexing', '스트림 멀티플렉싱'],
    explanation: {
      ko: 'HTTP/2 멀티플렉싱은 하나의 TCP 연결에서 여러 스트림을 병렬 처리해 HTTP/1.1의 Head-of-Line blocking을 제거합니다.',
      en: 'HTTP/2 multiplexing processes multiple streams in parallel over one TCP connection, eliminating the Head-of-Line blocking of HTTP/1.1.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'web-13',
    category: QuizCategory.WEB,
    prompt: {
      ko: 'HTTP 요청·응답에서 콘텐츠의 미디어 타입을 나타내는 헤더 이름은?',
      en: 'Which HTTP header indicates the media type of the content in a request or response?',
    },
    acceptedAnswers: ['Content-Type', 'content type', 'content-type'],
    explanation: {
      ko: 'Content-Type 헤더는 본문의 미디어 타입(예: application/json, text/html)을 지정해 수신자가 데이터를 올바르게 파싱하도록 합니다.',
      en: 'The Content-Type header specifies the media type of the body (e.g. application/json, text/html) so the receiver can parse it correctly.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'web-14',
    category: QuizCategory.WEB,
    prompt: {
      ko: 'JSON 형식으로 서명된 토큰을 사용해 서버 세션 없이 클라이언트 인증을 수행하는 표준은?',
      en: 'Which standard uses a signed JSON-format token to authenticate clients without server-side sessions?',
    },
    acceptedAnswers: ['JWT', 'json web token', 'json 웹 토큰'],
    explanation: {
      ko: 'JWT(JSON Web Token)는 Header.Payload.Signature 구조로 서명되어 서버가 세션을 저장하지 않고도 토큰의 무결성을 검증할 수 있습니다.',
      en: 'JWT (JSON Web Token) is signed with a Header.Payload.Signature structure, allowing servers to verify token integrity without storing sessions.',
    },
    difficulty: 'MEDIUM',
  },
  // ── HARD (6문항) ──────────────────────────────────────────
  {
    id: 'web-15',
    category: QuizCategory.WEB,
    prompt: {
      ko: 'HTTP/3가 TCP 대신 사용하는 전송 계층 프로토콜은?',
      en: 'Which transport-layer protocol does HTTP/3 use instead of TCP?',
    },
    acceptedAnswers: ['QUIC', 'quic'],
    explanation: {
      ko: 'HTTP/3는 UDP 기반의 QUIC 프로토콜을 사용해 TCP Head-of-Line blocking을 완전히 제거하고 연결 설정 지연을 줄입니다.',
      en: 'HTTP/3 uses the UDP-based QUIC protocol to completely eliminate TCP Head-of-Line blocking and reduce connection setup latency.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'web-16',
    category: QuizCategory.WEB,
    prompt: {
      ko: '쿠키 속성 중, 자바스크립트에서 document.cookie로 접근하지 못하도록 차단하는 속성은?',
      en: 'Which cookie attribute prevents JavaScript from accessing the cookie via document.cookie?',
    },
    acceptedAnswers: ['HttpOnly', 'httponly', 'http only', 'http-only'],
    explanation: {
      ko: 'HttpOnly 속성이 설정된 쿠키는 브라우저의 document.cookie API로 읽을 수 없어 XSS 공격으로부터 쿠키 탈취를 방어합니다.',
      en: 'Cookies with the HttpOnly attribute cannot be read via document.cookie, defending against cookie theft through XSS attacks.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'web-17',
    category: QuizCategory.WEB,
    prompt: {
      ko: 'REST에서 캐싱 여부·유효기간 등을 제어하는 HTTP 응답 헤더는?',
      en: 'Which HTTP response header controls caching behavior such as cacheability and expiry in REST APIs?',
    },
    acceptedAnswers: ['Cache-Control', 'cache control', 'cache-control'],
    explanation: {
      ko: 'Cache-Control 헤더는 max-age, no-cache, no-store 등의 지시어로 프록시와 브라우저의 캐싱 동작을 세밀하게 제어합니다.',
      en: 'The Cache-Control header uses directives like max-age, no-cache, and no-store to precisely control caching behavior in browsers and proxies.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'web-18',
    category: QuizCategory.WEB,
    prompt: {
      ko: '쿠키 속성 중, 교차 사이트 요청(cross-site request)에서 쿠키 전송 여부를 제어해 CSRF를 완화하는 속성은?',
      en: 'Which cookie attribute controls whether a cookie is sent with cross-site requests, helping mitigate CSRF?',
    },
    acceptedAnswers: ['SameSite', 'samesite', 'same site', 'same-site'],
    explanation: {
      ko: 'SameSite 속성은 Strict·Lax·None 값으로 교차 출처 요청 시 쿠키 전송 범위를 제한해 CSRF 공격을 완화합니다.',
      en: 'The SameSite attribute (Strict, Lax, or None) restricts when cookies are sent on cross-origin requests, mitigating CSRF attacks.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'web-19',
    category: QuizCategory.WEB,
    prompt: {
      ko: 'OAuth 2.0 인가 흐름에서 클라이언트가 보호 자원에 접근할 때 사용하는 단기 토큰은?',
      en: 'In OAuth 2.0 authorization flows, what is the short-lived token a client uses to access protected resources?',
    },
    acceptedAnswers: ['액세스 토큰', 'access token', 'accesstoken'],
    explanation: {
      ko: 'OAuth 2.0의 액세스 토큰은 짧은 유효기간을 가지며, 만료 시 리프레시 토큰으로 갱신해 보호 자원에 대한 접근을 유지합니다.',
      en: 'In OAuth 2.0 the access token has a short lifetime; when it expires it can be renewed using a refresh token to maintain access to protected resources.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'web-20',
    category: QuizCategory.WEB,
    prompt: {
      ko: '리소스의 특정 버전을 식별하는 토큰으로, 조건부 요청(If-None-Match)과 함께 캐시 유효성 검증에 사용되는 HTTP 헤더는?',
      en: 'Which HTTP header contains an opaque token identifying a specific version of a resource, used with If-None-Match for cache validation?',
    },
    acceptedAnswers: ['ETag', 'etag', 'e-tag', 'entity tag'],
    explanation: {
      ko: 'ETag는 서버가 리소스 버전을 식별하는 토큰으로, 클라이언트가 If-None-Match에 이 값을 포함하면 서버는 변경 없을 때 304를 반환해 불필요한 전송을 줄입니다.',
      en: 'ETag is a token identifying a resource version; when the client sends it in If-None-Match and the resource is unchanged, the server returns 304, avoiding redundant data transfer.',
    },
    difficulty: 'HARD',
  },
];
