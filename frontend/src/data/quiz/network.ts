/**
 * @file 네트워크 분야 CS 퀴즈 문항 (30문항)
 * @domain quiz
 * @layer data
 * @related src/data/quiz/types.ts, src/data/quiz/index.ts
 */
import { QuizCategory, type QuizQuestion } from './types';

/** 네트워크(Network) 분야 단답형 문항 목록. */
export const NETWORK_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'net-01',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '물리·데이터링크·네트워크·전송·세션·표현·응용의 7개 계층으로 통신을 모델링한 표준은?',
      en: 'Which standard models communication as 7 layers: physical, data link, network, transport, session, presentation, and application?',
    },
    acceptedAnswers: ['OSI 7계층', 'OSI', 'osi model', 'osi 7 layer', 'osi 7 layers', 'osi모델', 'osi참조모델'],
    explanation: {
      ko: 'OSI 7계층은 네트워크 통신 기능을 7개 계층으로 나눈 개념적 참조 모델입니다.',
      en: 'The OSI model is a 7-layer conceptual reference model dividing network communication into seven layers.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'net-02',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '연결 지향이며 순서 보장·재전송으로 신뢰성 있는 전송을 제공하는 전송 계층 프로토콜은?',
      en: 'Which transport-layer protocol is connection-oriented and provides reliable, ordered delivery with retransmission?',
    },
    acceptedAnswers: ['TCP', 'transmission control protocol', '전송제어프로토콜'],
    explanation: {
      ko: 'TCP는 연결을 수립하고 순서 보장·흐름/혼잡 제어·재전송으로 신뢰성 있는 전송을 제공합니다.',
      en: 'TCP establishes a connection and provides reliable delivery with ordering, flow/congestion control, and retransmission.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'net-03',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '비연결형으로 신뢰성 보장 없이 빠른 전송을 제공하는 전송 계층 프로토콜은?',
      en: 'Which connectionless transport-layer protocol offers fast delivery without reliability guarantees?',
    },
    acceptedAnswers: ['UDP', 'user datagram protocol', '사용자데이터그램프로토콜'],
    explanation: {
      ko: 'UDP는 연결 설정 없이 데이터그램을 전송하며 순서·재전송을 보장하지 않아 지연이 낮습니다.',
      en: 'UDP sends datagrams without connection setup and does not guarantee ordering or retransmission, yielding low latency.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'net-04',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'TCP 연결을 SYN → SYN-ACK → ACK 순으로 수립하는 3단계 절차의 이름은?',
      en: 'What is the name of the 3-step procedure that establishes a TCP connection via SYN, SYN-ACK, ACK?',
    },
    acceptedAnswers: ['3way handshake', '3-way handshake', 'three way handshake', '3웨이핸드셰이크', '쓰리웨이핸드셰이크', '3방향핸드셰이크', '3 way handshake', '쓰리웨이핸드쉐이크'],
    explanation: {
      ko: '3-way handshake는 SYN, SYN-ACK, ACK 세 번의 교환으로 TCP 연결을 수립하는 절차입니다.',
      en: 'The 3-way handshake establishes a TCP connection through three exchanges: SYN, SYN-ACK, ACK.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'net-05',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'FIN → ACK → FIN → ACK 순으로 TCP 연결을 종료하는 4단계 절차의 이름은?',
      en: 'What is the name of the 4-step procedure that terminates a TCP connection via FIN, ACK, FIN, ACK?',
    },
    acceptedAnswers: ['4way handshake', '4-way handshake', 'four way handshake', '4웨이핸드셰이크', '포웨이핸드셰이크', '4방향핸드셰이크', '4 way handshake'],
    explanation: {
      ko: '4-way handshake는 양측이 각각 FIN/ACK를 교환해 TCP 연결을 정상 종료하는 절차입니다.',
      en: 'The 4-way handshake gracefully closes a TCP connection as both sides exchange FIN and ACK.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'net-06',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '도메인 이름(예: example.com)을 IP 주소로 변환해 주는 시스템은?',
      en: 'Which system translates domain names such as example.com into IP addresses?',
    },
    acceptedAnswers: ['DNS', 'domain name system', '도메인네임시스템', '도메인이름시스템'],
    explanation: {
      ko: 'DNS는 사람이 읽는 도메인 이름을 기계가 사용하는 IP 주소로 변환하는 분산 시스템입니다.',
      en: 'DNS is a distributed system that resolves human-readable domain names into machine IP addresses.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'net-07',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '웹에서 SSL/TLS로 암호화된 보안 HTTP 통신을 가리키는 프로토콜 약어는?',
      en: 'Which protocol acronym refers to secure HTTP communication encrypted with SSL/TLS on the web?',
    },
    acceptedAnswers: ['HTTPS', 'http secure', 'hypertext transfer protocol secure'],
    explanation: {
      ko: 'HTTPS는 HTTP에 SSL/TLS 암호화를 더해 기밀성과 무결성을 제공하는 프로토콜입니다.',
      en: 'HTTPS adds SSL/TLS encryption to HTTP to provide confidentiality and integrity.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'net-08',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '서버 리소스를 조회(읽기)할 때 사용하며 본문 없이 요청하는 대표적인 HTTP 메서드는?',
      en: 'Which HTTP method is typically used to read/retrieve a resource without a request body?',
    },
    acceptedAnswers: ['GET', 'get메서드', 'get 메서드'],
    explanation: {
      ko: 'GET은 서버의 리소스를 조회하는 안전(safe)·멱등(idempotent) 메서드입니다.',
      en: 'GET retrieves a resource and is a safe, idempotent HTTP method.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'net-09',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '요청이 성공적으로 처리되었음을 나타내는 가장 대표적인 HTTP 상태 코드는?',
      en: 'Which HTTP status code most commonly indicates a successful request?',
    },
    acceptedAnswers: ['200', '200 ok', '200ok'],
    explanation: {
      ko: 'HTTP 200 OK는 요청이 정상적으로 처리되었음을 나타내는 성공 상태 코드입니다.',
      en: 'HTTP 200 OK indicates that the request was processed successfully.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'net-10',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '요청한 리소스를 찾을 수 없을 때 반환되는 HTTP 상태 코드는?',
      en: 'Which HTTP status code is returned when the requested resource cannot be found?',
    },
    acceptedAnswers: ['404', '404 not found', '404notfound'],
    explanation: {
      ko: 'HTTP 404 Not Found는 서버가 요청한 리소스를 찾지 못했음을 의미합니다.',
      en: 'HTTP 404 Not Found means the server could not find the requested resource.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'net-11',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '서버 내부 오류로 요청을 처리하지 못했을 때 반환되는 5xx 대표 상태 코드는?',
      en: 'Which representative 5xx status code is returned when the server fails due to an internal error?',
    },
    acceptedAnswers: ['500', '500 internal server error', 'internal server error'],
    explanation: {
      ko: 'HTTP 500 Internal Server Error는 서버 측 내부 오류로 요청을 처리하지 못했음을 나타냅니다.',
      en: 'HTTP 500 Internal Server Error indicates the server failed to process the request due to an internal error.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'net-12',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '32비트 길이로 점으로 구분된 네 개의 8비트 숫자(예: 192.168.0.1)로 표기하는 IP 주소 버전은?',
      en: 'Which IP address version is 32 bits long, written as four dot-separated octets (e.g., 192.168.0.1)?',
    },
    acceptedAnswers: ['IPv4', 'ip v4', 'internet protocol version 4', 'ipv 4'],
    explanation: {
      ko: 'IPv4는 32비트 주소 체계로 약 43억 개의 주소를 표현하며 점으로 구분된 4옥텟으로 표기합니다.',
      en: 'IPv4 is a 32-bit addressing scheme with about 4.3 billion addresses, written as four dot-separated octets.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'net-13',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'IPv4 주소 고갈 문제를 해결하기 위해 도입된 128비트 길이의 IP 주소 버전은?',
      en: 'Which 128-bit IP address version was introduced to solve IPv4 address exhaustion?',
    },
    acceptedAnswers: ['IPv6', 'ip v6', 'internet protocol version 6', 'ipv 6'],
    explanation: {
      ko: 'IPv6는 128비트 주소 체계로 사실상 무한에 가까운 주소를 제공해 IPv4 고갈 문제를 해결합니다.',
      en: 'IPv6 uses a 128-bit addressing scheme providing a virtually unlimited address space to solve IPv4 exhaustion.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'net-14',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'IP 주소에서 네트워크 부분과 호스트 부분을 구분하는 데 쓰이는 비트 마스크는?',
      en: 'Which bit mask is used to separate the network portion from the host portion of an IP address?',
    },
    acceptedAnswers: ['서브넷마스크', '서브넷 마스크', 'subnet mask', 'subnetmask', '넷마스크', 'netmask'],
    explanation: {
      ko: '서브넷 마스크는 IP 주소에서 네트워크 식별 비트와 호스트 식별 비트를 구분합니다.',
      en: 'A subnet mask distinguishes the network-identifying bits from the host-identifying bits of an IP address.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'net-15',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '네트워크 인터페이스 카드(NIC)에 고유하게 부여된 48비트 물리(하드웨어) 주소는?',
      en: 'What is the 48-bit physical (hardware) address uniquely assigned to a network interface card?',
    },
    acceptedAnswers: ['MAC 주소', 'MAC', 'mac address', 'mac주소', '맥주소', '맥어드레스', 'media access control address', '물리주소'],
    explanation: {
      ko: 'MAC 주소는 NIC에 부여되는 48비트 고유 물리 주소로 데이터링크 계층에서 사용됩니다.',
      en: 'A MAC address is a 48-bit unique physical address assigned to a NIC, used at the data link layer.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'net-16',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'IP 주소를 같은 네트워크 내의 MAC 주소로 변환해 주는 프로토콜은?',
      en: 'Which protocol resolves an IP address to a MAC address within the same network?',
    },
    acceptedAnswers: ['ARP', 'address resolution protocol', '주소결정프로토콜'],
    explanation: {
      ko: 'ARP는 같은 LAN에서 목적지 IP 주소에 대응하는 MAC 주소를 알아내는 프로토콜입니다.',
      en: 'ARP maps a destination IP address to its MAC address within the same LAN.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'net-17',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'ping과 traceroute에 사용되며 오류·진단 메시지를 전달하는 네트워크 계층 프로토콜은?',
      en: 'Which network-layer protocol used by ping and traceroute carries error and diagnostic messages?',
    },
    acceptedAnswers: ['ICMP', 'internet control message protocol', '인터넷제어메시지프로토콜'],
    explanation: {
      ko: 'ICMP는 IP 패킷의 오류 보고와 진단(ping, traceroute)에 사용되는 네트워크 계층 프로토콜입니다.',
      en: 'ICMP is a network-layer protocol used for error reporting and diagnostics such as ping and traceroute.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'net-18',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '서로 다른 네트워크 간 최적 경로를 선택해 패킷을 전달하는 네트워크 계층 장비는?',
      en: 'Which network-layer device forwards packets by choosing the best path between different networks?',
    },
    acceptedAnswers: ['라우터', 'router'],
    explanation: {
      ko: '라우터는 라우팅 테이블을 기반으로 서로 다른 네트워크 사이의 최적 경로로 패킷을 전달합니다.',
      en: 'A router forwards packets along the best path between different networks based on its routing table.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'net-19',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '사설 IP 주소를 공인 IP 주소로 변환해 여러 기기가 하나의 공인 IP를 공유하게 하는 기술은?',
      en: 'Which technique translates private IP addresses to a public IP so many devices share one public IP?',
    },
    acceptedAnswers: ['NAT', 'network address translation', '네트워크주소변환'],
    explanation: {
      ko: 'NAT는 사설 IP를 공인 IP로 변환해 IP 절약과 내부 네트워크 은닉을 제공합니다.',
      en: 'NAT translates private IPs to a public IP, conserving addresses and hiding the internal network.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'net-20',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '네트워크에 연결된 호스트에 IP 주소·서브넷마스크·게이트웨이를 자동으로 할당하는 프로토콜은?',
      en: 'Which protocol automatically assigns IP address, subnet mask, and gateway to hosts on a network?',
    },
    acceptedAnswers: ['DHCP', 'dynamic host configuration protocol', '동적호스트구성프로토콜'],
    explanation: {
      ko: 'DHCP는 호스트에 IP 주소 등 네트워크 설정을 자동으로 할당해 주는 프로토콜입니다.',
      en: 'DHCP automatically assigns network configuration such as IP addresses to hosts.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'net-21',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'HTTP와 HTTPS가 기본으로 사용하는 포트 번호는 각각 몇 번인가? (예: 00/000 형식)',
      en: 'What are the default port numbers used by HTTP and HTTPS respectively?',
    },
    acceptedAnswers: ['80 443', '80,443', '80 / 443', '80443', 'http80https443'],
    explanation: {
      ko: 'HTTP는 기본 포트 80번, HTTPS는 기본 포트 443번을 사용합니다.',
      en: 'HTTP uses default port 80 and HTTPS uses default port 443.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'net-22',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'IP 주소와 포트 번호의 조합으로 네트워크 통신의 양 끝점을 식별하는 추상 개념은?',
      en: 'Which abstraction identifies a network communication endpoint as a combination of IP address and port?',
    },
    acceptedAnswers: ['소켓', 'socket'],
    explanation: {
      ko: '소켓은 IP 주소와 포트 번호의 조합으로 통신의 종단점을 식별하는 추상화입니다.',
      en: 'A socket is the endpoint abstraction identified by the combination of IP address and port number.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'net-23',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '여러 서버에 트래픽을 분산해 가용성과 처리량을 높이는 네트워크 장비·소프트웨어는?',
      en: 'Which device or software distributes traffic across multiple servers to improve availability and throughput?',
    },
    acceptedAnswers: ['로드밸런서', '로드 밸런서', 'load balancer', 'loadbalancer', '부하분산기'],
    explanation: {
      ko: '로드 밸런서는 들어오는 트래픽을 여러 서버로 분산해 부하를 고르게 나누고 가용성을 높입니다.',
      en: 'A load balancer distributes incoming traffic across multiple servers to balance load and increase availability.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'net-24',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '지리적으로 분산된 캐시 서버로 콘텐츠를 사용자 가까이에서 전송해 지연을 줄이는 네트워크는?',
      en: 'Which network of geographically distributed cache servers delivers content closer to users to reduce latency?',
    },
    acceptedAnswers: ['CDN', 'content delivery network', 'content distribution network', '콘텐츠전송네트워크'],
    explanation: {
      ko: 'CDN은 지리적으로 분산된 엣지 캐시 서버에서 콘텐츠를 전송해 지연 시간을 줄입니다.',
      en: 'A CDN serves content from geographically distributed edge cache servers to reduce latency.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'net-25',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '다른 출처(origin)의 리소스 요청을 브라우저가 제어하도록 정의한 보안 정책의 약어는?',
      en: 'What is the acronym for the security policy that controls browser requests for resources from a different origin?',
    },
    acceptedAnswers: ['CORS', 'cross origin resource sharing', '교차출처리소스공유'],
    explanation: {
      ko: 'CORS는 브라우저가 다른 출처의 리소스 요청을 허용·차단하도록 제어하는 보안 메커니즘입니다.',
      en: 'CORS is a security mechanism that controls whether a browser may request resources from a different origin.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'net-26',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '자원을 URI로 식별하고 HTTP 메서드로 상태를 주고받는 무상태 아키텍처 스타일은?',
      en: 'Which stateless architecture style identifies resources by URI and exchanges state via HTTP methods?',
    },
    acceptedAnswers: ['REST', 'restful', 'representational state transfer'],
    explanation: {
      ko: 'REST는 자원을 URI로 식별하고 HTTP 메서드로 표현 상태를 전송하는 무상태 아키텍처 스타일입니다.',
      en: 'REST is a stateless architecture style that identifies resources by URI and transfers their representation via HTTP methods.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'net-27',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '하나의 TCP 연결 위에서 클라이언트·서버가 양방향 실시간 통신을 하는 프로토콜은?',
      en: 'Which protocol enables full-duplex real-time communication between client and server over a single TCP connection?',
    },
    acceptedAnswers: ['웹소켓', '웹 소켓', 'websocket', 'web socket'],
    explanation: {
      ko: 'WebSocket은 하나의 TCP 연결 위에서 양방향(full-duplex) 실시간 통신을 제공하는 프로토콜입니다.',
      en: 'WebSocket provides full-duplex real-time communication over a single persistent TCP connection.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'net-28',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '암호화와 복호화에 동일한 하나의 키를 사용하는 암호화 방식은?',
      en: 'Which encryption scheme uses the same single key for both encryption and decryption?',
    },
    acceptedAnswers: ['대칭키암호화', '대칭 키 암호화', '대칭키', '대칭암호화', 'symmetric encryption', 'symmetric key encryption', 'symmetric'],
    explanation: {
      ko: '대칭키 암호화는 암호화와 복호화에 같은 키를 사용해 빠르지만 키 공유가 과제입니다(예: AES).',
      en: 'Symmetric encryption uses the same key for encryption and decryption; it is fast but requires secure key sharing (e.g., AES).',
    },
    difficulty: 'HARD',
  },
  {
    id: 'net-29',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '공개키로 암호화하고 개인키로 복호화하는, 서로 다른 키 쌍을 쓰는 암호화 방식은?',
      en: 'Which encryption scheme uses a key pair, encrypting with a public key and decrypting with a private key?',
    },
    acceptedAnswers: ['비대칭키암호화', '비대칭 키 암호화', '비대칭키', '비대칭암호화', '공개키암호화', 'asymmetric encryption', 'asymmetric key encryption', 'public key encryption', 'asymmetric'],
    explanation: {
      ko: '비대칭키(공개키) 암호화는 공개키와 개인키 쌍을 사용하며 키 분배 문제를 해결합니다(예: RSA).',
      en: 'Asymmetric (public-key) encryption uses a public/private key pair and solves the key distribution problem (e.g., RSA).',
    },
    difficulty: 'HARD',
  },
  {
    id: 'net-30',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '미리 정의된 규칙에 따라 네트워크 트래픽을 허용·차단하는 보안 시스템은?',
      en: 'Which security system permits or blocks network traffic according to predefined rules?',
    },
    acceptedAnswers: ['방화벽', 'firewall', '파이어월'],
    explanation: {
      ko: '방화벽은 정해진 보안 규칙에 따라 들어오고 나가는 네트워크 트래픽을 허용하거나 차단합니다.',
      en: 'A firewall permits or blocks inbound and outbound network traffic based on predefined security rules.',
    },
    difficulty: 'EASY',
  },
];
