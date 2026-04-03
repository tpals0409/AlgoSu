-- =========================================================================
-- AlgoSu Demo Seed Data
-- =========================================================================
-- 목적: 면접관/체험자용 데모 환경 시드 데이터 (멱등 리셋 가능)
--
-- 실행 방법 (3개 DB에 각각 실행):
--
-- 1) identity_db (유저, 스터디, 멤버):
--    kubectl exec -n algosu pod/postgres-XXX -- psql -U algosu_admin -d identity_db
--    그리고 identity_db 섹션만 복사-붙여넣기, 또는:
--    cat demo-seed-identity.sql | kubectl exec -i -n algosu pod/postgres-XXX -- psql -U algosu_admin -d identity_db
--
-- 2) problem_db (문제):
--    kubectl exec -n algosu pod/postgres-problem-XXX -- psql -U problem_user -d problem_db
--
-- 3) submission_db (제출, 리뷰, 노트):
--    kubectl exec -n algosu pod/postgres-XXX -- psql -U algosu_admin -d submission_db
--
-- 리셋: 동일 스크립트 재실행 (DELETE -> INSERT 패턴)
-- =========================================================================

-- 고정 UUID 목록
-- 유저:       00000000-0000-4000-a000-000000000001 ~ 003
-- 스터디:     00000000-0000-4000-a000-000000000010
-- 멤버:       00000000-0000-4000-a000-000000000021 ~ 023
-- 문제:       00000000-0000-4000-a000-000000000101 ~ 106
-- 제출:       00000000-0000-4000-a000-000000000201 ~ 20f
-- publicId:   00000000-0000-4000-b000-XXXXXXXXXXXX (별도 네임스페이스)


-- ============================================================================
-- identity_db
-- ============================================================================

BEGIN;

-- ---------- users ----------
DELETE FROM study_members WHERE study_id = '00000000-0000-4000-a000-000000000010';
DELETE FROM studies WHERE id = '00000000-0000-4000-a000-000000000010';
DELETE FROM users WHERE id IN (
  '00000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000002',
  '00000000-0000-4000-a000-000000000003'
);

INSERT INTO users (id, email, name, avatar_url, oauth_provider, github_connected, github_user_id, github_username, github_token, "publicId", profile_slug, is_profile_public, created_at, updated_at, deleted_at)
VALUES
  ('00000000-0000-4000-a000-000000000001', 'demo@algosu.kr',  '김알고', 'preset:avatar-1', 'google', false, NULL, NULL, NULL, '00000000-0000-4000-b000-000000000001', 'kim-algo',   true,  '2026-03-01 09:00:00+09', '2026-03-15 18:00:00+09', NULL),
  ('00000000-0000-4000-a000-000000000002', 'demo2@algosu.kr', '이코딩', 'preset:avatar-2', 'naver',  false, NULL, NULL, NULL, '00000000-0000-4000-b000-000000000002', 'lee-coding',  true,  '2026-03-01 09:05:00+09', '2026-03-15 17:00:00+09', NULL),
  ('00000000-0000-4000-a000-000000000003', 'demo3@algosu.kr', '박수학', 'preset:avatar-3', 'kakao',  false, NULL, NULL, NULL, '00000000-0000-4000-b000-000000000003', 'park-suhak', true,  '2026-03-01 09:10:00+09', '2026-03-14 20:00:00+09', NULL);

-- ---------- studies ----------
INSERT INTO studies (id, name, description, created_by, github_repo, status, "groundRules", avatar_url, "publicId", created_at, updated_at)
VALUES (
  '00000000-0000-4000-a000-000000000010',
  '알고리즘 마스터즈',
  '매주 알고리즘 문제를 함께 풀고 코드리뷰하는 스터디입니다.',
  '00000000-0000-4000-a000-000000000001',
  NULL,
  'ACTIVE',
  E'매주 3문제 풀기\n코드리뷰 필수',
  'preset:study-default',
  '00000000-0000-4000-b000-000000000010',
  '2026-03-01 10:00:00+09',
  '2026-03-15 10:00:00+09'
);

-- ---------- study_members ----------
INSERT INTO study_members (id, study_id, user_id, role, nickname, joined_at)
VALUES
  ('00000000-0000-4000-a000-000000000021', '00000000-0000-4000-a000-000000000010', '00000000-0000-4000-a000-000000000001', 'ADMIN',  '김알고', '2026-03-01 10:00:00+09'),
  ('00000000-0000-4000-a000-000000000022', '00000000-0000-4000-a000-000000000010', '00000000-0000-4000-a000-000000000002', 'MEMBER', '이코딩', '2026-03-01 10:30:00+09'),
  ('00000000-0000-4000-a000-000000000023', '00000000-0000-4000-a000-000000000010', '00000000-0000-4000-a000-000000000003', 'MEMBER', '박수학', '2026-03-01 11:00:00+09');

COMMIT;


-- ============================================================================
-- problem_db
-- ============================================================================

BEGIN;

DELETE FROM problems WHERE id IN (
  '00000000-0000-4000-a000-000000000101',
  '00000000-0000-4000-a000-000000000102',
  '00000000-0000-4000-a000-000000000103',
  '00000000-0000-4000-a000-000000000104',
  '00000000-0000-4000-a000-000000000105',
  '00000000-0000-4000-a000-000000000106'
);

INSERT INTO problems (id, title, description, week_number, difficulty, level, source_url, source_platform, status, deadline, allowed_languages, tags, study_id, created_by, "publicId", created_at, updated_at)
VALUES
  (
    '00000000-0000-4000-a000-000000000101',
    'Two Sum',
    '주어진 배열에서 두 수의 합이 target이 되는 인덱스 쌍을 찾으세요.',
    'Week 1', 'BRONZE', 5,
    'https://www.acmicpc.net/problem/3273',
    'BOJ', 'ACTIVE', NULL,
    '["python","javascript","java"]',
    '["해시","배열"]',
    '00000000-0000-4000-a000-000000000010',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000101',
    '2026-03-02 09:00:00+09', '2026-03-02 09:00:00+09'
  ),
  (
    '00000000-0000-4000-a000-000000000102',
    '유효한 괄호',
    '괄호 문자열이 올바르게 닫히는지 판별하세요.',
    'Week 1', 'SILVER', 8,
    'https://school.programmers.co.kr/learn/courses/30/lessons/12909',
    '프로그래머스', 'ACTIVE', NULL,
    '["python","javascript","java"]',
    '["스택"]',
    '00000000-0000-4000-a000-000000000010',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000102',
    '2026-03-02 09:30:00+09', '2026-03-02 09:30:00+09'
  ),
  (
    '00000000-0000-4000-a000-000000000103',
    '이진 탐색',
    '정렬된 배열에서 특정 값의 위치를 이진 탐색으로 찾으세요.',
    'Week 2', 'SILVER', 10,
    'https://www.acmicpc.net/problem/1920',
    'BOJ', 'ACTIVE', NULL,
    '["python","javascript","java"]',
    '["이진탐색"]',
    '00000000-0000-4000-a000-000000000010',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000103',
    '2026-03-08 09:00:00+09', '2026-03-08 09:00:00+09'
  ),
  (
    '00000000-0000-4000-a000-000000000104',
    '최장 증가 부분 수열',
    '수열에서 가장 긴 증가하는 부분 수열의 길이를 구하세요.',
    'Week 2', 'GOLD', 15,
    'https://www.acmicpc.net/problem/11053',
    'BOJ', 'ACTIVE', NULL,
    '["python","javascript","java"]',
    '["DP","이진탐색"]',
    '00000000-0000-4000-a000-000000000010',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000104',
    '2026-03-08 09:30:00+09', '2026-03-08 09:30:00+09'
  ),
  (
    '00000000-0000-4000-a000-000000000105',
    '다익스트라 최단경로',
    '가중치 그래프에서 시작 노드로부터 모든 노드까지의 최단 거리를 구하세요.',
    'Week 3', 'GOLD', 18,
    'https://www.acmicpc.net/problem/1753',
    'BOJ', 'ACTIVE', NULL,
    '["python","javascript","java"]',
    '["그래프","최단경로"]',
    '00000000-0000-4000-a000-000000000010',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000105',
    '2026-03-14 09:00:00+09', '2026-03-14 09:00:00+09'
  ),
  (
    '00000000-0000-4000-a000-000000000106',
    '문자열 압축',
    '문자열을 1개 이상 단위로 잘라 압축했을 때 가장 짧은 길이를 구하세요.',
    'Week 3', 'SILVER', 12,
    'https://school.programmers.co.kr/learn/courses/30/lessons/60057',
    '프로그래머스', 'ACTIVE', NULL,
    '["python","javascript","java"]',
    '["문자열","구현"]',
    '00000000-0000-4000-a000-000000000010',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000106',
    '2026-03-14 09:30:00+09', '2026-03-14 09:30:00+09'
  );

COMMIT;


-- ============================================================================
-- submission_db
-- ============================================================================

BEGIN;

-- 먼저 연관 데이터 삭제
DELETE FROM study_notes WHERE "studyId" = '00000000-0000-4000-a000-000000000010';
DELETE FROM review_comments WHERE "studyId" = '00000000-0000-4000-a000-000000000010';
DELETE FROM submissions WHERE id IN (
  '00000000-0000-4000-a000-000000000201',
  '00000000-0000-4000-a000-000000000202',
  '00000000-0000-4000-a000-000000000203',
  '00000000-0000-4000-a000-000000000204',
  '00000000-0000-4000-a000-000000000205',
  '00000000-0000-4000-a000-000000000206',
  '00000000-0000-4000-a000-000000000207',
  '00000000-0000-4000-a000-000000000208',
  '00000000-0000-4000-a000-000000000209',
  '00000000-0000-4000-a000-00000000020a',
  '00000000-0000-4000-a000-00000000020b',
  '00000000-0000-4000-a000-00000000020c',
  '00000000-0000-4000-a000-00000000020d',
  '00000000-0000-4000-a000-00000000020e',
  '00000000-0000-4000-a000-00000000020f'
);

-- ---------- submissions ----------
-- 김알고 (user 1): 5 submissions
-- 이코딩 (user 2): 5 submissions
-- 박수학 (user 3): 5 submissions

-- #1: 김알고 - Two Sum (Python, score 85)
INSERT INTO submissions (id, study_id, user_id, problem_id, language, code, saga_step, github_sync_status, github_file_path, week_number, idempotency_key, ai_analysis_status, ai_skipped, ai_feedback, ai_score, ai_optimized_code, is_late, "publicId", created_at, updated_at)
VALUES (
  '00000000-0000-4000-a000-000000000201',
  '00000000-0000-4000-a000-000000000010',
  '00000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000101',
  'python',
  E'def two_sum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i\n    return []\n\nimport sys\ninput = sys.stdin.readline\nn = int(input())\narr = list(map(int, input().split()))\ntarget = int(input())\nresult = two_sum(arr, target)\nprint(len(result) // 2)',
  'DONE', 'SKIPPED', NULL, 'Week 1', NULL,
  'completed', false,
  '{"totalScore":85,"summary":"해시맵을 활용한 효율적인 Two Sum 풀이입니다. O(n) 시간복잡도로 최적에 가깝습니다.","timeComplexity":"O(n)","spaceComplexity":"O(n)","codeLines":16,"categories":[{"name":"효율성","score":90,"comment":"해시맵을 활용한 O(n) 풀이로 매우 효율적입니다. 불필요한 이중 루프를 피했습니다.","highlights":[{"startLine":2,"endLine":7}]},{"name":"가독성","score":85,"comment":"변수명(seen, complement)이 의미를 잘 전달합니다. 함수 분리도 좋습니다.","highlights":[{"startLine":1,"endLine":1}]},{"name":"정확성","score":80,"comment":"기본 케이스는 잘 처리하지만, 동일한 원소가 두 번 사용되는 경우의 edge case 검증이 필요합니다.","highlights":[]}],"optimizedCode":null}',
  85, NULL, false,
  '00000000-0000-4000-b000-000000000201',
  '2026-03-03 14:00:00+09', '2026-03-03 14:05:00+09'
);

-- #2: 김알고 - 유효한 괄호 (JavaScript, score 88)
INSERT INTO submissions (id, study_id, user_id, problem_id, language, code, saga_step, github_sync_status, github_file_path, week_number, idempotency_key, ai_analysis_status, ai_skipped, ai_feedback, ai_score, ai_optimized_code, is_late, "publicId", created_at, updated_at)
VALUES (
  '00000000-0000-4000-a000-000000000202',
  '00000000-0000-4000-a000-000000000010',
  '00000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000102',
  'javascript',
  E'function solution(s) {\n  const stack = [];\n  for (const ch of s) {\n    if (ch === ''('') {\n      stack.push(ch);\n    } else {\n      if (stack.length === 0) return false;\n      stack.pop();\n    }\n  }\n  return stack.length === 0;\n}',
  'DONE', 'SKIPPED', NULL, 'Week 1', NULL,
  'completed', false,
  '{"totalScore":88,"summary":"스택을 활용한 깔끔한 괄호 검증 구현입니다. 코드가 간결하고 이해하기 쉽습니다.","timeComplexity":"O(n)","spaceComplexity":"O(n)","codeLines":12,"categories":[{"name":"효율성","score":85,"comment":"스택 기반 O(n) 풀이로 효율적입니다. 조기 반환(early return)으로 불필요한 연산을 줄였습니다.","highlights":[{"startLine":7,"endLine":7}]},{"name":"가독성","score":92,"comment":"함수 구조가 깔끔하고, 조건 분기가 명확합니다.","highlights":[{"startLine":1,"endLine":4}]},{"name":"정확성","score":88,"comment":"빈 문자열, 홀수 길이 등 기본 edge case를 잘 처리합니다.","highlights":[]}],"optimizedCode":null}',
  88, NULL, false,
  '00000000-0000-4000-b000-000000000202',
  '2026-03-04 10:00:00+09', '2026-03-04 10:03:00+09'
);

-- #3: 김알고 - 이진 탐색 (Python, score 82)
INSERT INTO submissions (id, study_id, user_id, problem_id, language, code, saga_step, github_sync_status, github_file_path, week_number, idempotency_key, ai_analysis_status, ai_skipped, ai_feedback, ai_score, ai_optimized_code, is_late, "publicId", created_at, updated_at)
VALUES (
  '00000000-0000-4000-a000-000000000203',
  '00000000-0000-4000-a000-000000000010',
  '00000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000103',
  'python',
  E'import sys\ninput = sys.stdin.readline\n\ndef binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return True\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return False\n\nn = int(input())\narr = sorted(list(map(int, input().split())))\nm = int(input())\nqueries = list(map(int, input().split()))\nfor q in queries:\n    print(1 if binary_search(arr, q) else 0)',
  'DONE', 'SKIPPED', NULL, 'Week 2', NULL,
  'completed', false,
  '{"totalScore":82,"summary":"정석적인 이진 탐색 구현입니다. 정렬 후 탐색하는 접근이 올바릅니다.","timeComplexity":"O(n log n + m log n)","spaceComplexity":"O(n)","codeLines":21,"categories":[{"name":"효율성","score":80,"comment":"이진 탐색으로 각 쿼리를 O(log n)에 처리합니다. set을 사용하면 O(1)로 더 빠를 수 있습니다.","highlights":[{"startLine":4,"endLine":14}]},{"name":"가독성","score":85,"comment":"함수 분리가 잘 되어 있고, 변수명이 직관적입니다.","highlights":[{"startLine":4,"endLine":5}]},{"name":"정확성","score":82,"comment":"left <= right 조건이 정확합니다. 빈 배열 edge case도 처리됩니다.","highlights":[]}],"optimizedCode":null}',
  82, NULL, false,
  '00000000-0000-4000-b000-000000000203',
  '2026-03-09 15:00:00+09', '2026-03-09 15:04:00+09'
);

-- #4: 김알고 - 최장 증가 부분 수열 (Java, score 90)
INSERT INTO submissions (id, study_id, user_id, problem_id, language, code, saga_step, github_sync_status, github_file_path, week_number, idempotency_key, ai_analysis_status, ai_skipped, ai_feedback, ai_score, ai_optimized_code, is_late, "publicId", created_at, updated_at)
VALUES (
  '00000000-0000-4000-a000-000000000204',
  '00000000-0000-4000-a000-000000000010',
  '00000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000104',
  'java',
  E'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for (int i = 0; i < n; i++) arr[i] = sc.nextInt();\n\n        int[] dp = new int[n];\n        Arrays.fill(dp, 1);\n        int answer = 1;\n\n        for (int i = 1; i < n; i++) {\n            for (int j = 0; j < i; j++) {\n                if (arr[j] < arr[i]) {\n                    dp[i] = Math.max(dp[i], dp[j] + 1);\n                }\n            }\n            answer = Math.max(answer, dp[i]);\n        }\n        System.out.println(answer);\n    }\n}',
  'DONE', 'SKIPPED', NULL, 'Week 2', NULL,
  'completed', false,
  '{"totalScore":90,"summary":"DP를 활용한 정확한 LIS 구현입니다. O(n^2) 풀이로 정석적입니다.","timeComplexity":"O(n^2)","spaceComplexity":"O(n)","codeLines":24,"categories":[{"name":"효율성","score":85,"comment":"O(n^2) DP 풀이는 정확하지만, 이진 탐색을 활용하면 O(n log n)으로 최적화 가능합니다.","highlights":[{"startLine":14,"endLine":21}]},{"name":"가독성","score":92,"comment":"표준적인 Java 코드 구조입니다. dp 배열의 의미가 명확합니다.","highlights":[{"startLine":10,"endLine":12}]},{"name":"정확성","score":93,"comment":"dp 점화식이 정확하고, 초기값 설정과 answer 갱신이 올바릅니다.","highlights":[]}],"optimizedCode":null}',
  90, NULL, false,
  '00000000-0000-4000-b000-000000000204',
  '2026-03-10 11:00:00+09', '2026-03-10 11:05:00+09'
);

-- #5: 김알고 - 다익스트라 (Python, score 92)
INSERT INTO submissions (id, study_id, user_id, problem_id, language, code, saga_step, github_sync_status, github_file_path, week_number, idempotency_key, ai_analysis_status, ai_skipped, ai_feedback, ai_score, ai_optimized_code, is_late, "publicId", created_at, updated_at)
VALUES (
  '00000000-0000-4000-a000-000000000205',
  '00000000-0000-4000-a000-000000000010',
  '00000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000105',
  'python',
  E'import heapq\nimport sys\ninput = sys.stdin.readline\nINF = float(''inf'')\n\ndef dijkstra(graph, start, n):\n    dist = [INF] * (n + 1)\n    dist[start] = 0\n    pq = [(0, start)]\n\n    while pq:\n        cost, node = heapq.heappop(pq)\n        if cost > dist[node]:\n            continue\n        for next_node, weight in graph[node]:\n            new_cost = cost + weight\n            if new_cost < dist[next_node]:\n                dist[next_node] = new_cost\n                heapq.heappush(pq, (new_cost, next_node))\n    return dist\n\nV, E = map(int, input().split())\nstart = int(input())\ngraph = [[] for _ in range(V + 1)]\nfor _ in range(E):\n    u, v, w = map(int, input().split())\n    graph[u].append((v, w))\n\nresult = dijkstra(graph, start, V)\nfor i in range(1, V + 1):\n    print("INF" if result[i] == INF else result[i])',
  'DONE', 'SKIPPED', NULL, 'Week 3', NULL,
  'completed', false,
  '{"totalScore":92,"summary":"힙을 활용한 다익스트라 알고리즘의 교과서적인 구현입니다. 최적화까지 잘 적용되어 있습니다.","timeComplexity":"O((V+E) log V)","spaceComplexity":"O(V+E)","codeLines":31,"categories":[{"name":"효율성","score":95,"comment":"우선순위 큐와 방문 체크(cost > dist[node])를 활용한 최적 구현입니다.","highlights":[{"startLine":12,"endLine":14}]},{"name":"가독성","score":90,"comment":"함수 분리가 잘 되어 있고, 변수명이 명확합니다. sys.stdin 활용도 좋습니다.","highlights":[{"startLine":6,"endLine":7}]},{"name":"정확성","score":92,"comment":"무한대 초기화, 시작 노드 0 설정 등 모든 로직이 정확합니다.","highlights":[]}],"optimizedCode":null}',
  92, NULL, false,
  '00000000-0000-4000-b000-000000000205',
  '2026-03-15 09:00:00+09', '2026-03-15 09:06:00+09'
);

-- #6: 이코딩 - Two Sum (JavaScript, score 78)
INSERT INTO submissions (id, study_id, user_id, problem_id, language, code, saga_step, github_sync_status, github_file_path, week_number, idempotency_key, ai_analysis_status, ai_skipped, ai_feedback, ai_score, ai_optimized_code, is_late, "publicId", created_at, updated_at)
VALUES (
  '00000000-0000-4000-a000-000000000206',
  '00000000-0000-4000-a000-000000000010',
  '00000000-0000-4000-a000-000000000002',
  '00000000-0000-4000-a000-000000000101',
  'javascript',
  E'const readline = require(''readline'');\nconst rl = readline.createInterface({ input: process.stdin });\nconst lines = [];\nrl.on(''line'', (line) => lines.push(line));\nrl.on(''close'', () => {\n  const n = parseInt(lines[0]);\n  const nums = lines[1].split('' '').map(Number);\n  const target = parseInt(lines[2]);\n  const map = new Map();\n  let count = 0;\n  for (let i = 0; i < n; i++) {\n    const complement = target - nums[i];\n    if (map.has(complement)) count++;\n    map.set(nums[i], i);\n  }\n  console.log(count);\n});',
  'DONE', 'SKIPPED', NULL, 'Week 1', NULL,
  'completed', false,
  '{"totalScore":78,"summary":"Map을 활용한 풀이로 접근은 좋으나, 입출력 처리가 다소 장황합니다.","timeComplexity":"O(n)","spaceComplexity":"O(n)","codeLines":17,"categories":[{"name":"효율성","score":82,"comment":"Map 자료구조를 활용해 O(n) 풀이를 구현했습니다.","highlights":[{"startLine":9,"endLine":14}]},{"name":"가독성","score":72,"comment":"readline 보일러플레이트가 코드 비중을 높입니다. 핵심 로직을 함수로 분리하면 좋겠습니다.","highlights":[{"startLine":1,"endLine":4}]},{"name":"정확성","score":80,"comment":"기본 동작은 정확하나, edge case 테스트가 부족할 수 있습니다.","highlights":[]}],"optimizedCode":null}',
  78, NULL, false,
  '00000000-0000-4000-b000-000000000206',
  '2026-03-03 16:00:00+09', '2026-03-03 16:04:00+09'
);

-- #7: 이코딩 - 유효한 괄호 (Python, score 72)
INSERT INTO submissions (id, study_id, user_id, problem_id, language, code, saga_step, github_sync_status, github_file_path, week_number, idempotency_key, ai_analysis_status, ai_skipped, ai_feedback, ai_score, ai_optimized_code, is_late, "publicId", created_at, updated_at)
VALUES (
  '00000000-0000-4000-a000-000000000207',
  '00000000-0000-4000-a000-000000000010',
  '00000000-0000-4000-a000-000000000002',
  '00000000-0000-4000-a000-000000000102',
  'python',
  E'def solution(s):\n    count = 0\n    for char in s:\n        if char == ''('':\n            count += 1\n        else:\n            count -= 1\n        if count < 0:\n            return False\n    return count == 0',
  'DONE', 'SKIPPED', NULL, 'Week 1', NULL,
  'completed', false,
  '{"totalScore":72,"summary":"카운터 방식의 간결한 풀이입니다. 단일 괄호 유형에 특화된 접근입니다.","timeComplexity":"O(n)","spaceComplexity":"O(1)","codeLines":10,"categories":[{"name":"효율성","score":85,"comment":"스택 대신 카운터를 사용해 O(1) 공간복잡도를 달성했습니다. 훌륭합니다.","highlights":[{"startLine":2,"endLine":7}]},{"name":"가독성","score":68,"comment":"변수명 count가 다소 모호합니다. open_count 등 더 명확한 이름을 권장합니다.","highlights":[{"startLine":2,"endLine":2}]},{"name":"정확성","score":65,"comment":"단일 유형 괄호는 처리하지만, 다중 괄호({, [) 확장 시 리팩토링이 필요합니다.","highlights":[]}],"optimizedCode":null}',
  72, NULL, false,
  '00000000-0000-4000-b000-000000000207',
  '2026-03-04 14:00:00+09', '2026-03-04 14:03:00+09'
);

-- #8: 이코딩 - 이진 탐색 (Java, score 75)
INSERT INTO submissions (id, study_id, user_id, problem_id, language, code, saga_step, github_sync_status, github_file_path, week_number, idempotency_key, ai_analysis_status, ai_skipped, ai_feedback, ai_score, ai_optimized_code, is_late, "publicId", created_at, updated_at)
VALUES (
  '00000000-0000-4000-a000-000000000208',
  '00000000-0000-4000-a000-000000000010',
  '00000000-0000-4000-a000-000000000002',
  '00000000-0000-4000-a000-000000000103',
  'java',
  E'import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        int n = Integer.parseInt(br.readLine().trim());\n        int[] arr = Arrays.stream(br.readLine().trim().split(" ")).mapToInt(Integer::parseInt).toArray();\n        Arrays.sort(arr);\n        int m = Integer.parseInt(br.readLine().trim());\n        int[] queries = Arrays.stream(br.readLine().trim().split(" ")).mapToInt(Integer::parseInt).toArray();\n        StringBuilder sb = new StringBuilder();\n        for (int q : queries) {\n            sb.append(Arrays.binarySearch(arr, q) >= 0 ? 1 : 0).append("\\n");\n        }\n        System.out.print(sb);\n    }\n}',
  'DONE', 'SKIPPED', NULL, 'Week 2', NULL,
  'completed', false,
  '{"totalScore":75,"summary":"Arrays.binarySearch 내장 함수를 활용한 풀이입니다. StringBuilder로 출력을 최적화했습니다.","timeComplexity":"O(n log n + m log n)","spaceComplexity":"O(n)","codeLines":18,"categories":[{"name":"효율성","score":80,"comment":"내장 binarySearch와 StringBuilder 활용으로 효율적입니다.","highlights":[{"startLine":14,"endLine":14}]},{"name":"가독성","score":65,"comment":"한 줄에 너무 많은 연산을 체이닝하고 있습니다. 중간 변수를 사용하면 가독성이 향상됩니다.","highlights":[{"startLine":8,"endLine":8}]},{"name":"정확성","score":78,"comment":"Arrays.binarySearch의 반환값 처리가 정확합니다. 음수 반환 시 미존재 처리가 올바릅니다.","highlights":[]}],"optimizedCode":null}',
  75, NULL, false,
  '00000000-0000-4000-b000-000000000208',
  '2026-03-10 09:00:00+09', '2026-03-10 09:04:00+09'
);

-- #9: 이코딩 - 최장 증가 부분 수열 (JavaScript, score 80)
INSERT INTO submissions (id, study_id, user_id, problem_id, language, code, saga_step, github_sync_status, github_file_path, week_number, idempotency_key, ai_analysis_status, ai_skipped, ai_feedback, ai_score, ai_optimized_code, is_late, "publicId", created_at, updated_at)
VALUES (
  '00000000-0000-4000-a000-000000000209',
  '00000000-0000-4000-a000-000000000010',
  '00000000-0000-4000-a000-000000000002',
  '00000000-0000-4000-a000-000000000104',
  'javascript',
  E'const readline = require(''readline'');\nconst rl = readline.createInterface({ input: process.stdin });\nconst lines = [];\nrl.on(''line'', (l) => lines.push(l));\nrl.on(''close'', () => {\n  const n = parseInt(lines[0]);\n  const arr = lines[1].split('' '').map(Number);\n  const dp = new Array(n).fill(1);\n  for (let i = 1; i < n; i++) {\n    for (let j = 0; j < i; j++) {\n      if (arr[j] < arr[i]) {\n        dp[i] = Math.max(dp[i], dp[j] + 1);\n      }\n    }\n  }\n  console.log(Math.max(...dp));\n});',
  'DONE', 'SKIPPED', NULL, 'Week 2', NULL,
  'completed', false,
  '{"totalScore":80,"summary":"DP 기반 LIS 풀이입니다. JavaScript의 스프레드 연산자를 활용한 최댓값 계산이 깔끔합니다.","timeComplexity":"O(n^2)","spaceComplexity":"O(n)","codeLines":17,"categories":[{"name":"효율성","score":75,"comment":"O(n^2) 풀이는 올바르지만, Math.max(...dp)는 배열이 크면 스택 오버플로우 위험이 있습니다.","highlights":[{"startLine":16,"endLine":16}]},{"name":"가독성","score":82,"comment":"DP 로직이 깔끔하고 이해하기 쉽습니다.","highlights":[{"startLine":8,"endLine":15}]},{"name":"정확성","score":83,"comment":"점화식 구현이 정확합니다.","highlights":[]}],"optimizedCode":null}',
  80, NULL, false,
  '00000000-0000-4000-b000-000000000209',
  '2026-03-11 10:00:00+09', '2026-03-11 10:04:00+09'
);

-- #10: 이코딩 - 문자열 압축 (Python, score 70)
INSERT INTO submissions (id, study_id, user_id, problem_id, language, code, saga_step, github_sync_status, github_file_path, week_number, idempotency_key, ai_analysis_status, ai_skipped, ai_feedback, ai_score, ai_optimized_code, is_late, "publicId", created_at, updated_at)
VALUES (
  '00000000-0000-4000-a000-00000000020a',
  '00000000-0000-4000-a000-000000000010',
  '00000000-0000-4000-a000-000000000002',
  '00000000-0000-4000-a000-000000000106',
  'python',
  E'def solution(s):\n    if len(s) == 1:\n        return 1\n    answer = len(s)\n    for step in range(1, len(s) // 2 + 1):\n        compressed = ""\n        prev = s[:step]\n        count = 1\n        for i in range(step, len(s), step):\n            curr = s[i:i+step]\n            if curr == prev:\n                count += 1\n            else:\n                compressed += (str(count) if count > 1 else "") + prev\n                prev = curr\n                count = 1\n        compressed += (str(count) if count > 1 else "") + prev\n        answer = min(answer, len(compressed))\n    return answer',
  'DONE', 'SKIPPED', NULL, 'Week 3', NULL,
  'completed', false,
  '{"totalScore":70,"summary":"완전 탐색 기반의 문자열 압축 풀이입니다. 로직은 정확하나 최적화 여지가 있습니다.","timeComplexity":"O(n^2)","spaceComplexity":"O(n)","codeLines":19,"categories":[{"name":"효율성","score":65,"comment":"모든 단위에 대해 탐색하는 O(n^2) 접근입니다. 문자열 연결 대신 리스트 조인을 사용하면 성능이 향상됩니다.","highlights":[{"startLine":5,"endLine":18}]},{"name":"가독성","score":70,"comment":"변수명(prev, curr, count)이 적절합니다. 다만 중첩 루프로 인해 복잡도가 높아 보입니다.","highlights":[{"startLine":6,"endLine":8}]},{"name":"정확성","score":75,"comment":"길이 1인 문자열 edge case 처리가 있지만, 마지막 토큰 처리 로직을 별도로 확인해야 합니다.","highlights":[{"startLine":2,"endLine":3}]}],"optimizedCode":null}',
  70, NULL, false,
  '00000000-0000-4000-b000-00000000020a',
  '2026-03-15 14:00:00+09', '2026-03-15 14:05:00+09'
);

-- #11: 박수학 - Two Sum (Java, score 65)
INSERT INTO submissions (id, study_id, user_id, problem_id, language, code, saga_step, github_sync_status, github_file_path, week_number, idempotency_key, ai_analysis_status, ai_skipped, ai_feedback, ai_score, ai_optimized_code, is_late, "publicId", created_at, updated_at)
VALUES (
  '00000000-0000-4000-a000-00000000020b',
  '00000000-0000-4000-a000-000000000010',
  '00000000-0000-4000-a000-000000000003',
  '00000000-0000-4000-a000-000000000101',
  'java',
  E'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for (int i = 0; i < n; i++) arr[i] = sc.nextInt();\n        int target = sc.nextInt();\n        int count = 0;\n        for (int i = 0; i < n; i++) {\n            for (int j = i + 1; j < n; j++) {\n                if (arr[i] + arr[j] == target) count++;\n            }\n        }\n        System.out.println(count);\n    }\n}',
  'DONE', 'SKIPPED', NULL, 'Week 1', NULL,
  'completed', false,
  '{"totalScore":65,"summary":"이중 루프 기반의 브루트포스 풀이입니다. 정확하지만 효율성 개선이 필요합니다.","timeComplexity":"O(n^2)","spaceComplexity":"O(1)","codeLines":18,"categories":[{"name":"효율성","score":50,"comment":"이중 루프 O(n^2) 풀이는 n이 크면 시간 초과가 발생할 수 있습니다. HashMap을 활용하면 O(n)으로 개선 가능합니다.","highlights":[{"startLine":11,"endLine":14}]},{"name":"가독성","score":75,"comment":"직관적인 브루트포스 로직으로 이해하기 쉽습니다.","highlights":[{"startLine":10,"endLine":14}]},{"name":"정확성","score":70,"comment":"기본 로직은 정확하지만, 대용량 입력에서 Scanner 대신 BufferedReader를 권장합니다.","highlights":[]}],"optimizedCode":null}',
  65, NULL, false,
  '00000000-0000-4000-b000-00000000020b',
  '2026-03-04 20:00:00+09', '2026-03-04 20:04:00+09'
);

-- #12: 박수학 - 이진 탐색 (JavaScript, score 95)
INSERT INTO submissions (id, study_id, user_id, problem_id, language, code, saga_step, github_sync_status, github_file_path, week_number, idempotency_key, ai_analysis_status, ai_skipped, ai_feedback, ai_score, ai_optimized_code, is_late, "publicId", created_at, updated_at)
VALUES (
  '00000000-0000-4000-a000-00000000020c',
  '00000000-0000-4000-a000-000000000010',
  '00000000-0000-4000-a000-000000000003',
  '00000000-0000-4000-a000-000000000103',
  'javascript',
  E'const readline = require(''readline'');\nconst rl = readline.createInterface({ input: process.stdin });\nconst lines = [];\nrl.on(''line'', (l) => lines.push(l));\nrl.on(''close'', () => {\n  const n = parseInt(lines[0]);\n  const numSet = new Set(lines[1].split('' '').map(Number));\n  const m = parseInt(lines[2]);\n  const queries = lines[3].split('' '').map(Number);\n  const result = queries.map(q => numSet.has(q) ? 1 : 0);\n  console.log(result.join(''\\n''));\n});',
  'DONE', 'SKIPPED', NULL, 'Week 2', NULL,
  'completed', false,
  '{"totalScore":95,"summary":"Set을 활용한 O(1) 탐색으로 최적의 풀이입니다. 코드도 매우 간결합니다.","timeComplexity":"O(n + m)","spaceComplexity":"O(n)","codeLines":12,"categories":[{"name":"효율성","score":98,"comment":"Set을 활용해 각 쿼리를 O(1)에 처리합니다. 이진 탐색보다 오히려 효율적인 접근입니다.","highlights":[{"startLine":7,"endLine":10}]},{"name":"가독성","score":93,"comment":"map과 join을 활용한 함수형 스타일이 깔끔합니다.","highlights":[{"startLine":10,"endLine":11}]},{"name":"정확성","score":95,"comment":"Set의 has 메서드로 정확한 존재 여부를 판별합니다. 출력 형식도 올바릅니다.","highlights":[]}],"optimizedCode":null}',
  95, NULL, false,
  '00000000-0000-4000-b000-00000000020c',
  '2026-03-09 20:00:00+09', '2026-03-09 20:03:00+09'
);

-- #13: 박수학 - 최장 증가 부분 수열 (Python, score 83)
INSERT INTO submissions (id, study_id, user_id, problem_id, language, code, saga_step, github_sync_status, github_file_path, week_number, idempotency_key, ai_analysis_status, ai_skipped, ai_feedback, ai_score, ai_optimized_code, is_late, "publicId", created_at, updated_at)
VALUES (
  '00000000-0000-4000-a000-00000000020d',
  '00000000-0000-4000-a000-000000000010',
  '00000000-0000-4000-a000-000000000003',
  '00000000-0000-4000-a000-000000000104',
  'python',
  E'import bisect\nimport sys\ninput = sys.stdin.readline\n\ndef lis_length(arr):\n    tails = []\n    for num in arr:\n        pos = bisect.bisect_left(tails, num)\n        if pos == len(tails):\n            tails.append(num)\n        else:\n            tails[pos] = num\n    return len(tails)\n\nn = int(input())\narr = list(map(int, input().split()))\nprint(lis_length(arr))',
  'DONE', 'SKIPPED', NULL, 'Week 2', NULL,
  'completed', false,
  '{"totalScore":83,"summary":"이진 탐색(bisect)을 활용한 O(n log n) LIS 풀이입니다. 최적의 시간복잡도를 달성했습니다.","timeComplexity":"O(n log n)","spaceComplexity":"O(n)","codeLines":17,"categories":[{"name":"효율성","score":95,"comment":"bisect_left를 활용한 O(n log n) 풀이로 최적입니다.","highlights":[{"startLine":7,"endLine":12}]},{"name":"가독성","score":75,"comment":"tails 배열의 의미를 주석으로 설명하면 좋겠습니다. 알고리즘 자체가 직관적이지 않으므로 설명이 필요합니다.","highlights":[{"startLine":6,"endLine":6}]},{"name":"정확성","score":80,"comment":"bisect_left 사용이 정확합니다. 빈 배열과 단일 원소 배열도 올바르게 처리합니다.","highlights":[]}],"optimizedCode":null}',
  83, NULL, false,
  '00000000-0000-4000-b000-00000000020d',
  '2026-03-10 19:00:00+09', '2026-03-10 19:04:00+09'
);

-- #14: 박수학 - 다익스트라 (Java, score 77)
INSERT INTO submissions (id, study_id, user_id, problem_id, language, code, saga_step, github_sync_status, github_file_path, week_number, idempotency_key, ai_analysis_status, ai_skipped, ai_feedback, ai_score, ai_optimized_code, is_late, "publicId", created_at, updated_at)
VALUES (
  '00000000-0000-4000-a000-00000000020e',
  '00000000-0000-4000-a000-000000000010',
  '00000000-0000-4000-a000-000000000003',
  '00000000-0000-4000-a000-000000000105',
  'java',
  E'import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        StringTokenizer st = new StringTokenizer(br.readLine());\n        int V = Integer.parseInt(st.nextToken());\n        int E = Integer.parseInt(st.nextToken());\n        int start = Integer.parseInt(br.readLine().trim());\n\n        List<int[]>[] graph = new ArrayList[V + 1];\n        for (int i = 0; i <= V; i++) graph[i] = new ArrayList<>();\n        for (int i = 0; i < E; i++) {\n            st = new StringTokenizer(br.readLine());\n            int u = Integer.parseInt(st.nextToken());\n            int v = Integer.parseInt(st.nextToken());\n            int w = Integer.parseInt(st.nextToken());\n            graph[u].add(new int[]{v, w});\n        }\n\n        int[] dist = new int[V + 1];\n        Arrays.fill(dist, Integer.MAX_VALUE);\n        dist[start] = 0;\n        PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> a[0] - b[0]);\n        pq.offer(new int[]{0, start});\n\n        while (!pq.isEmpty()) {\n            int[] curr = pq.poll();\n            if (curr[0] > dist[curr[1]]) continue;\n            for (int[] next : graph[curr[1]]) {\n                int newDist = curr[0] + next[1];\n                if (newDist < dist[next[0]]) {\n                    dist[next[0]] = newDist;\n                    pq.offer(new int[]{newDist, next[0]});\n                }\n            }\n        }\n\n        StringBuilder sb = new StringBuilder();\n        for (int i = 1; i <= V; i++) {\n            sb.append(dist[i] == Integer.MAX_VALUE ? "INF" : dist[i]).append("\\n");\n        }\n        System.out.print(sb);\n    }\n}',
  'DONE', 'SKIPPED', NULL, 'Week 3', NULL,
  'completed', false,
  '{"totalScore":77,"summary":"Java로 구현한 다익스트라 알고리즘입니다. BufferedReader와 StringBuilder를 사용한 I/O 최적화가 돋보입니다.","timeComplexity":"O((V+E) log V)","spaceComplexity":"O(V+E)","codeLines":45,"categories":[{"name":"효율성","score":82,"comment":"PriorityQueue와 방문 체크를 올바르게 사용했습니다. I/O 최적화도 잘 되어 있습니다.","highlights":[{"startLine":25,"endLine":30}]},{"name":"가독성","score":68,"comment":"int[] 배열 대신 별도 클래스나 record를 사용하면 curr[0], curr[1] 같은 매직 인덱스를 피할 수 있습니다.","highlights":[{"startLine":29,"endLine":32}]},{"name":"정확성","score":80,"comment":"알고리즘 로직은 정확합니다. Integer.MAX_VALUE 오버플로우 방지를 위해 long 사용을 고려해보세요.","highlights":[]}],"optimizedCode":null}',
  77, NULL, false,
  '00000000-0000-4000-b000-00000000020e',
  '2026-03-15 16:00:00+09', '2026-03-15 16:06:00+09'
);

-- #15: 박수학 - 문자열 압축 (JavaScript, score 86)
INSERT INTO submissions (id, study_id, user_id, problem_id, language, code, saga_step, github_sync_status, github_file_path, week_number, idempotency_key, ai_analysis_status, ai_skipped, ai_feedback, ai_score, ai_optimized_code, is_late, "publicId", created_at, updated_at)
VALUES (
  '00000000-0000-4000-a000-00000000020f',
  '00000000-0000-4000-a000-000000000010',
  '00000000-0000-4000-a000-000000000003',
  '00000000-0000-4000-a000-000000000106',
  'javascript',
  E'function solution(s) {\n  if (s.length <= 1) return s.length;\n  let minLen = s.length;\n\n  for (let unit = 1; unit <= Math.floor(s.length / 2); unit++) {\n    const parts = [];\n    for (let i = 0; i < s.length; i += unit) {\n      parts.push(s.substring(i, i + unit));\n    }\n    let compressed = '''';\n    let count = 1;\n    for (let i = 1; i < parts.length; i++) {\n      if (parts[i] === parts[i - 1]) {\n        count++;\n      } else {\n        compressed += (count > 1 ? count : '''') + parts[i - 1];\n        count = 1;\n      }\n    }\n    compressed += (count > 1 ? count : '''') + parts[parts.length - 1];\n    minLen = Math.min(minLen, compressed.length);\n  }\n  return minLen;\n}',
  'DONE', 'SKIPPED', NULL, 'Week 3', NULL,
  'completed', false,
  '{"totalScore":86,"summary":"문자열을 단위별로 분할 후 압축하는 깔끔한 풀이입니다. parts 배열 활용이 좋습니다.","timeComplexity":"O(n^2)","spaceComplexity":"O(n)","codeLines":24,"categories":[{"name":"효율성","score":82,"comment":"substring과 배열 분할을 활용한 구현입니다. 문자열 비교가 주요 병목이지만 문제 제약 내에서는 충분합니다.","highlights":[{"startLine":6,"endLine":9}]},{"name":"가독성","score":90,"comment":"parts 배열로 분할하는 접근이 직관적입니다. 변수명과 구조가 깔끔합니다.","highlights":[{"startLine":6,"endLine":9}]},{"name":"정확성","score":87,"comment":"마지막 토큰 처리와 길이 1 edge case 모두 올바르게 처리합니다.","highlights":[{"startLine":2,"endLine":2}]}],"optimizedCode":null}',
  86, NULL, false,
  '00000000-0000-4000-b000-00000000020f',
  '2026-03-15 18:00:00+09', '2026-03-15 18:05:00+09'
);

-- ---------- review_comments (8개) ----------

-- 김알고가 이코딩의 Two Sum에 남긴 라인별 코멘트
INSERT INTO review_comments ("submissionId", "authorId", "studyId", "lineNumber", content, "deletedAt", "publicId", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-4000-a000-000000000206',
  '00000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000010',
  9,
  'Map을 활용한 접근이 좋습니다! 다만 변수명을 complement로 바꾸면 의도가 더 명확해질 것 같아요.',
  NULL,
  '00000000-0000-4000-b000-000000000301',
  '2026-03-04 09:00:00+09', '2026-03-04 09:00:00+09'
);

-- 박수학이 이코딩의 유효한 괄호에 남긴 전체 코멘트
INSERT INTO review_comments ("submissionId", "authorId", "studyId", "lineNumber", content, "deletedAt", "publicId", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-4000-a000-000000000207',
  '00000000-0000-4000-a000-000000000003',
  '00000000-0000-4000-a000-000000000010',
  NULL,
  '카운터 방식으로 공간복잡도를 O(1)로 줄인 게 인상적이에요. 다중 괄호 유형으로 확장하려면 딕셔너리를 활용해보세요.',
  NULL,
  '00000000-0000-4000-b000-000000000302',
  '2026-03-05 10:00:00+09', '2026-03-05 10:00:00+09'
);

-- 이코딩이 김알고의 이진 탐색에 남긴 라인별 코멘트
INSERT INTO review_comments ("submissionId", "authorId", "studyId", "lineNumber", content, "deletedAt", "publicId", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-4000-a000-000000000203',
  '00000000-0000-4000-a000-000000000002',
  '00000000-0000-4000-a000-000000000010',
  7,
  'mid 계산에서 (left + right) // 2 대신 left + (right - left) // 2 를 사용하면 오버플로우를 방지할 수 있습니다.',
  NULL,
  '00000000-0000-4000-b000-000000000303',
  '2026-03-10 11:00:00+09', '2026-03-10 11:00:00+09'
);

-- 김알고가 박수학의 Two Sum에 남긴 전체 코멘트
INSERT INTO review_comments ("submissionId", "authorId", "studyId", "lineNumber", content, "deletedAt", "publicId", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-4000-a000-00000000020b',
  '00000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000010',
  NULL,
  '브루트포스 접근도 좋지만, HashMap을 활용하면 O(n)에 풀 수 있어요. 다음에 시도해보세요!',
  NULL,
  '00000000-0000-4000-b000-000000000304',
  '2026-03-05 15:00:00+09', '2026-03-05 15:00:00+09'
);

-- 이코딩이 김알고의 다익스트라에 남긴 라인별 코멘트
INSERT INTO review_comments ("submissionId", "authorId", "studyId", "lineNumber", content, "deletedAt", "publicId", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-4000-a000-000000000205',
  '00000000-0000-4000-a000-000000000002',
  '00000000-0000-4000-a000-000000000010',
  13,
  'cost > dist[node] 체크로 이미 방문한 노드를 스킵하는 최적화가 깔끔합니다. 이 부분 덕분에 시간복잡도가 보장되네요.',
  NULL,
  '00000000-0000-4000-b000-000000000305',
  '2026-03-15 12:00:00+09', '2026-03-15 12:00:00+09'
);

-- 박수학이 김알고의 LIS에 남긴 전체 코멘트
INSERT INTO review_comments ("submissionId", "authorId", "studyId", "lineNumber", content, "deletedAt", "publicId", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-4000-a000-000000000204',
  '00000000-0000-4000-a000-000000000003',
  '00000000-0000-4000-a000-000000000010',
  NULL,
  'O(n^2) DP 풀이가 정석적이에요. 저는 bisect를 활용해 O(n log n)으로 풀었는데, 두 접근 다 알아두면 좋을 것 같습니다.',
  NULL,
  '00000000-0000-4000-b000-000000000306',
  '2026-03-11 14:00:00+09', '2026-03-11 14:00:00+09'
);

-- 김알고가 박수학의 이진 탐색에 남긴 라인별 코멘트
INSERT INTO review_comments ("submissionId", "authorId", "studyId", "lineNumber", content, "deletedAt", "publicId", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-4000-a000-00000000020c',
  '00000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000010',
  7,
  'Set을 활용한 발상이 좋네요! 이진 탐색 문제인데 해시셋으로 더 효율적으로 푸셨습니다. O(1) 탐색이라 최고예요.',
  NULL,
  '00000000-0000-4000-b000-000000000307',
  '2026-03-10 21:00:00+09', '2026-03-10 21:00:00+09'
);

-- 이코딩이 박수학의 문자열 압축에 남긴 전체 코멘트
INSERT INTO review_comments ("submissionId", "authorId", "studyId", "lineNumber", content, "deletedAt", "publicId", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-4000-a000-00000000020f',
  '00000000-0000-4000-a000-000000000002',
  '00000000-0000-4000-a000-000000000010',
  NULL,
  'parts 배열로 먼저 분할하는 접근이 깔끔합니다. 저는 인덱스로 직접 비교했는데 이 방식이 더 읽기 좋네요.',
  NULL,
  '00000000-0000-4000-b000-000000000308',
  '2026-03-15 20:00:00+09', '2026-03-15 20:00:00+09'
);

-- ---------- study_notes (2개) ----------

-- Week 1 스터디 노트 (문제 1: Two Sum)
INSERT INTO study_notes ("problemId", "studyId", content, "publicId", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-4000-a000-000000000101',
  '00000000-0000-4000-a000-000000000010',
  E'## Week 1 스터디 노트 - Two Sum\n\n### 핵심 포인트\n- **해시맵** 활용이 핵심: O(n^2) 브루트포스 → O(n) 최적화\n- complement = target - current 패턴 기억하기\n- 동일 원소 중복 사용 불가 조건 주의\n\n### 팀원 풀이 비교\n- 김알고: Python dict 활용, 가장 깔끔한 풀이\n- 이코딩: JS Map 활용, I/O 처리가 다소 장황\n- 박수학: Java 이중루프, 정확하지만 시간복잡도 개선 필요\n\n### 다음 주 목표\n- 해시 자료구조를 활용한 문제 더 풀어보기\n- Two Pointer 기법과 비교 학습',
  '00000000-0000-4000-b000-000000000401',
  '2026-03-06 20:00:00+09', '2026-03-06 20:00:00+09'
);

-- Week 2 스터디 노트 (문제 3: 이진 탐색)
INSERT INTO study_notes ("problemId", "studyId", content, "publicId", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-4000-a000-000000000103',
  '00000000-0000-4000-a000-000000000010',
  E'## Week 2 스터디 노트 - 이진 탐색 & LIS\n\n### 이진 탐색 핵심\n- **정렬된 배열**에서만 사용 가능\n- left, right, mid 포인터 관리가 핵심\n- bisect 라이브러리 (Python) / Arrays.binarySearch (Java) 활용 가능\n- Set을 활용한 O(1) 탐색도 유효한 대안 (박수학 풀이)\n\n### LIS 두 가지 접근\n1. **DP (O(n^2))**: dp[i] = arr[i]를 마지막으로 하는 LIS 길이\n2. **이진 탐색 (O(n log n))**: tails 배열 유지, bisect_left로 위치 탐색\n\n### 논의 사항\n- Python bisect vs 직접 구현: 실무에서는 라이브러리 사용 권장\n- Java의 Arrays.binarySearch 반환값 주의 (음수 = 미존재)',
  '00000000-0000-4000-b000-000000000402',
  '2026-03-12 20:00:00+09', '2026-03-12 20:00:00+09'
);

COMMIT;
