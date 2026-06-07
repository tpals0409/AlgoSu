/**
 * @file 네트워크 분야 CS 퀴즈 문항 (50문항)
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
  // ── 신규 20문항 (net-31 ~ net-50) ────────────────────────────────────────
  // EASY × 3
  {
    id: 'net-31',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '무선 LAN(Wi-Fi)에서 충돌을 사전에 회피하기 위해 전송 전 채널을 감지·대기하는 접근 방식의 약어는?',
      en: 'Which acronym describes the wireless LAN access method that senses the channel and backs off before transmitting to avoid collisions?',
    },
    acceptedAnswers: ['CSMA/CA', 'csma ca', 'carrier sense multiple access collision avoidance', '충돌회피'],
    explanation: {
      ko: 'CSMA/CA는 Wi-Fi에서 전송 전 채널이 비어 있는지 감지하고 무작위 백오프 타이머로 충돌을 회피합니다.',
      en: 'CSMA/CA senses the channel before transmitting and uses a random back-off timer to avoid collisions in wireless LANs.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'net-32',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '수신한 모든 프레임을 연결된 모든 포트에 그대로 브로드캐스트하는, 가장 단순한 물리 계층 LAN 연결 장비는?',
      en: 'Which simple physical-layer LAN device broadcasts every received frame to all connected ports?',
    },
    acceptedAnswers: ['허브', 'hub', '네트워크허브', 'ethernet hub'],
    explanation: {
      ko: '허브는 들어온 신호를 모든 포트로 중계하는 1계층 장비로, 스위치와 달리 목적지를 구분하지 않습니다.',
      en: 'A hub is a Layer-1 device that repeats an incoming signal to all ports, unlike a switch which forwards only to the destination.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'net-33',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'SSH(원격 보안 접속)가 기본적으로 사용하는 TCP 포트 번호는?',
      en: 'Which TCP port number does SSH use by default?',
    },
    acceptedAnswers: ['22', 'port 22', '22번', '22번 포트'],
    explanation: {
      ko: 'SSH는 기본 TCP 포트 22번을 사용해 암호화된 원격 터미널 접속을 제공합니다.',
      en: 'SSH uses TCP port 22 by default to provide an encrypted remote terminal session.',
    },
    difficulty: 'EASY',
  },
  // MEDIUM × 4
  {
    id: 'net-34',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'DHCP 클라이언트가 IP를 할당받을 때 거치는 4단계 메시지 순서를 영문 약어로 표현하면?',
      en: 'What acronym describes the four-message sequence a DHCP client goes through to obtain an IP address?',
    },
    acceptedAnswers: ['DORA', 'discover offer request ack', 'discover offer request acknowledge'],
    explanation: {
      ko: 'DHCP는 Discover→Offer→Request→Acknowledge(DORA) 4단계로 클라이언트에 IP를 동적 할당합니다.',
      en: 'DHCP assigns IPs dynamically through four messages: Discover, Offer, Request, Acknowledge (DORA).',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'net-35',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '하나의 물리 스위치를 여러 개의 논리적 독립 네트워크로 분리하는 데이터링크 계층 기술은?',
      en: 'Which data-link-layer technology partitions a single physical switch into multiple logically isolated networks?',
    },
    acceptedAnswers: ['VLAN', 'virtual lan', 'virtual local area network', '가상근거리통신망', '가상랜'],
    explanation: {
      ko: 'VLAN은 하나의 스위치를 복수의 논리 네트워크로 분할해 브로드캐스트 도메인을 줄이고 보안을 향상합니다.',
      en: 'VLAN partitions a physical switch into multiple logical networks, reducing broadcast domains and improving security.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'net-36',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'DNS 클라이언트가 DNS 리졸버에게 최종 답을 얻어줄 것을 요청하는 질의 방식과, 리졸버가 각 서버에 직접 답을 묻고 다음 서버를 안내받는 방식을 각각 무엇이라 하는가? (순서대로 "재귀/반복" 형식)',
      en: 'What are the two DNS query types: one where the resolver does all the work for the client, and one where the resolver is referred to the next server? (Answer: "recursive / iterative")',
    },
    acceptedAnswers: ['재귀 반복', '재귀/반복', '재귀질의 반복질의', 'recursive iterative', 'recursive / iterative', 'recursive and iterative'],
    explanation: {
      ko: '재귀(Recursive) 질의는 리졸버가 최종 답까지 대신 조회하며, 반복(Iterative) 질의는 리졸버가 각 서버에 직접 물어보며 다음 서버 참조를 받습니다.',
      en: 'In recursive queries, the resolver fetches the final answer for the client; in iterative queries, the resolver queries each server directly and receives referrals.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'net-37',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'IP 주소와 프리픽스 길이(예: 192.168.1.0/24)로 네트워크 범위를 표기하는 주소 체계는?',
      en: 'Which addressing scheme specifies a network range using an IP address and a prefix length (e.g., 192.168.1.0/24)?',
    },
    acceptedAnswers: ['CIDR', 'classless inter domain routing', '클래스리스 라우팅', '사이더', 'classless interdomain routing'],
    explanation: {
      ko: 'CIDR은 클래스 기반 구분을 없애고 슬래시 표기(프리픽스 길이)로 네트워크를 유연하게 분할합니다.',
      en: 'CIDR replaces class-based addressing with slash notation (prefix length) for flexible network partitioning.',
    },
    difficulty: 'MEDIUM',
  },
  // HARD × 13
  {
    id: 'net-38',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'TCP 혼잡 제어의 초기 단계로, 혼잡 윈도우를 1 MSS에서 시작해 ACK마다 지수적으로 증가시키는 알고리즘은?',
      en: 'Which TCP congestion-control phase starts the congestion window at 1 MSS and grows it exponentially with each ACK?',
    },
    acceptedAnswers: ['슬로우 스타트', '슬로우스타트', 'slow start', 'slowstart', '느린시작'],
    explanation: {
      ko: 'Slow Start는 cwnd를 1 MSS에서 시작해 각 ACK마다 1 MSS씩 증가(RTT당 2배)시켜 빠르게 대역폭을 탐색합니다.',
      en: 'Slow Start begins with cwnd=1 MSS and doubles it each RTT by adding 1 MSS per ACK to quickly probe available bandwidth.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'net-39',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'TCP 혼잡 제어에서 혼잡 윈도우가 ssthresh에 도달한 후 RTT당 1 MSS씩 선형으로 증가시키는 단계 이름은?',
      en: 'Which TCP congestion-control phase linearly grows the congestion window by 1 MSS per RTT once it reaches ssthresh?',
    },
    acceptedAnswers: ['혼잡회피', '혼잡 회피', 'congestion avoidance', 'congestionavoidance', 'additive increase'],
    explanation: {
      ko: 'Congestion Avoidance(혼잡 회피)는 cwnd가 ssthresh에 도달한 뒤 RTT당 1 MSS씩 선형 증가해 혼잡을 조심스럽게 탐색합니다.',
      en: 'Congestion Avoidance linearly increases cwnd by 1 MSS per RTT after reaching ssthresh, cautiously probing bandwidth.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'net-40',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'TCP에서 3개의 중복 ACK를 수신하면 타임아웃 없이 즉시 재전송을 수행하는 혼잡 제어 기법은?',
      en: 'Which TCP congestion-control technique triggers immediate retransmission upon receiving three duplicate ACKs without waiting for a timeout?',
    },
    acceptedAnswers: ['빠른 재전송', '빠른재전송', 'fast retransmit', 'fastretransmit', '고속재전송'],
    explanation: {
      ko: 'Fast Retransmit은 3개의 중복 ACK를 혼잡 신호로 해석하고 타임아웃 없이 손실 패킷을 즉시 재전송합니다.',
      en: 'Fast Retransmit interprets three duplicate ACKs as a congestion signal and retransmits the lost packet immediately without a timeout.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'net-41',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'Fast Retransmit 이후 ssthresh를 절반으로 줄이되 cwnd를 0이 아닌 ssthresh+3으로 설정해 파이프라인을 유지하는 TCP 기법은?',
      en: 'Which TCP technique, following Fast Retransmit, halves ssthresh but sets cwnd to ssthresh+3 to keep the pipeline inflated?',
    },
    acceptedAnswers: ['빠른 회복', '빠른회복', 'fast recovery', 'fastrecovery', '고속회복'],
    explanation: {
      ko: 'Fast Recovery는 3-dup ACK 이후 ssthresh를 cwnd/2로 줄이고 cwnd를 ssthresh+3으로 설정해 Slow Start로 떨어지지 않고 성능을 유지합니다.',
      en: 'Fast Recovery halves ssthresh and sets cwnd to ssthresh+3 after 3-dup ACKs, avoiding a drop to Slow Start and maintaining throughput.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'net-42',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'TCP 혼잡 제어에서 혼잡이 감지되면 윈도우를 절반으로 줄이고 다시 선형 증가하는 패턴을 가리키는 약어는?',
      en: 'Which acronym describes the TCP congestion-control pattern of halving the window on congestion and increasing it additively thereafter?',
    },
    acceptedAnswers: ['AIMD', 'additive increase multiplicative decrease', '가산증가 승산감소'],
    explanation: {
      ko: 'AIMD(Additive Increase Multiplicative Decrease)는 혼잡 시 윈도우를 절반으로 줄이고 이후 선형 증가하는 TCP 혼잡 제어 원칙입니다.',
      en: 'AIMD halves the congestion window on congestion detection and then increases it additively, forming the backbone of TCP congestion control.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'net-43',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'TCP 4-way handshake 완료 후 클라이언트 측에서 마지막 ACK를 보내고 일정 시간 대기하는 상태로, 지연 패킷을 처리하기 위해 존재하는 상태는?',
      en: 'Which TCP state does the active-close side enter after sending the final ACK, waiting to handle any delayed packets?',
    },
    acceptedAnswers: ['TIME_WAIT', 'time wait', 'timewait', 'TIME WAIT'],
    explanation: {
      ko: 'TIME_WAIT 상태는 2MSL(최대 세그먼트 수명의 2배) 동안 유지되어 지연된 패킷이 새 연결에 영향을 주지 않도록 보장합니다.',
      en: 'TIME_WAIT lasts 2 × MSL to ensure delayed packets from the old connection cannot corrupt a new connection on the same port pair.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'net-44',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'TCP 연결에서 상대방이 FIN을 보냈지만 자신은 아직 데이터 전송 중이어서 FIN을 보내지 않은 반쪽 종료 상태는?',
      en: 'Which TCP state occurs when the peer has sent FIN but the local side has not yet sent its own FIN because it still has data to send?',
    },
    acceptedAnswers: ['CLOSE_WAIT', 'close wait', 'closewait', 'CLOSE WAIT'],
    explanation: {
      ko: 'CLOSE_WAIT는 상대방의 FIN에 ACK를 보낸 뒤 자신의 FIN을 아직 보내지 않은 상태로, 애플리케이션이 소켓을 닫지 않으면 누수가 발생합니다.',
      en: 'CLOSE_WAIT means the peer\'s FIN was ACKed but the local FIN has not been sent yet; failure to close the socket causes a resource leak.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'net-45',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '작은 데이터를 즉시 보내지 않고 ACK가 올 때까지 버퍼에 모아 한 번에 전송하는 TCP 최적화 알고리즘은?',
      en: 'Which TCP optimization algorithm buffers small outgoing segments and sends them together once an ACK is received?',
    },
    acceptedAnswers: ['Nagle 알고리즘', '나글 알고리즘', 'nagle algorithm', 'nagle', '나글'],
    explanation: {
      ko: 'Nagle 알고리즘은 미전송 데이터가 MSS 미만이면 ACK 수신 또는 버퍼가 MSS에 찰 때까지 전송을 지연해 작은 패킷(tinygram)을 줄입니다.',
      en: 'The Nagle algorithm delays sending sub-MSS data until an ACK arrives or the buffer reaches MSS, reducing tinygram overhead.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'net-46',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '네트워크 경로에서 단편화 없이 한 번에 전송 가능한 IP 패킷의 최대 크기(바이트)를 무엇이라 하는가?',
      en: 'What term denotes the maximum size in bytes of an IP packet that can be transmitted on a network path without fragmentation?',
    },
    acceptedAnswers: ['MTU', 'maximum transmission unit', '최대전송단위'],
    explanation: {
      ko: 'MTU(Maximum Transmission Unit)는 링크 계층이 한 번에 전송할 수 있는 최대 IP 패킷 크기이며, 이더넷의 기본값은 1500바이트입니다.',
      en: 'MTU is the maximum IP packet size a link can carry without fragmentation; Ethernet\'s default MTU is 1500 bytes.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'net-47',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '링크 상태 정보를 전체 라우터에 플러딩하고 다익스트라 알고리즘으로 최단 경로를 계산하는 내부 게이트웨이 라우팅 프로토콜은?',
      en: 'Which interior gateway routing protocol floods link-state information to all routers and computes shortest paths with Dijkstra\'s algorithm?',
    },
    acceptedAnswers: ['OSPF', 'open shortest path first', '오픈 쇼티스트 패스 퍼스트'],
    explanation: {
      ko: 'OSPF는 링크 상태 라우팅 프로토콜로 모든 라우터가 동일한 토폴로지 데이터베이스를 유지하고 다익스트라로 최단 경로를 계산합니다.',
      en: 'OSPF is a link-state protocol where all routers share identical topology databases and compute shortest paths via Dijkstra\'s algorithm.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'net-48',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: '자율 시스템(AS) 간 경로를 경로 벡터(path-vector) 방식으로 교환하는 인터넷의 핵심 외부 게이트웨이 라우팅 프로토콜은?',
      en: 'Which exterior gateway routing protocol exchanges routes between autonomous systems using path-vector information?',
    },
    acceptedAnswers: ['BGP', 'border gateway protocol', '경계게이트웨이프로토콜'],
    explanation: {
      ko: 'BGP는 AS 간 라우팅을 담당하는 경로 벡터 프로토콜로, 인터넷 백본의 AS 사이에서 경로 정보를 교환합니다.',
      en: 'BGP is the path-vector protocol for inter-AS routing, exchanging reachability information between autonomous systems on the Internet backbone.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'net-49',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'HTTP/1.1에서 Head-of-Line Blocking 문제를 해결하기 위해 HTTP/2가 도입한, 하나의 TCP 연결 위에서 여러 요청·응답 스트림을 동시에 전달하는 기능은?',
      en: 'Which HTTP/2 feature resolves HTTP/1.1 Head-of-Line Blocking by sending multiple request/response streams concurrently over one TCP connection?',
    },
    acceptedAnswers: ['멀티플렉싱', 'multiplexing', 'http2 multiplexing', '스트림 다중화', '다중화'],
    explanation: {
      ko: 'HTTP/2 멀티플렉싱은 하나의 TCP 연결 위에서 여러 스트림을 병렬 전송해 HTTP/1.1의 HOL 블로킹 문제를 해소합니다.',
      en: 'HTTP/2 multiplexing sends multiple streams in parallel over a single TCP connection, eliminating the HTTP/1.1 HOL blocking problem.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'net-50',
    category: QuizCategory.NETWORK,
    prompt: {
      ko: 'TLS 1.3에서 최초 핸드셰이크 시 클라이언트가 ClientHello에 키 공유 데이터를 함께 보내 왕복 횟수를 줄인 결과, 세션 수립에 필요한 왕복(RTT) 횟수는?',
      en: 'How many round trips does a TLS 1.3 full handshake require, given that the client sends key-share data in the ClientHello?',
    },
    acceptedAnswers: ['1', '1 RTT', '1RTT', '1회', '한번', '1 round trip'],
    explanation: {
      ko: 'TLS 1.3은 ClientHello에 키 공유(Key Share)를 포함시켜 서버가 한 번의 왕복으로 핸드셰이크를 완료(1-RTT)하며, 재연결 시 0-RTT도 지원합니다.',
      en: 'TLS 1.3 includes key-share data in ClientHello so the server can complete the handshake in 1 RTT; 0-RTT is also supported for session resumption.',
    },
    difficulty: 'HARD',
  },
];
