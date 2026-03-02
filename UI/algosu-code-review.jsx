import { useState, useEffect } from "react";

const THEMES = {
  light: {
    bg: "#FAFAF8", bgAlt: "#F3F1EE", bgCard: "#FFFFFF",
    border: "#E8E5E0", borderHover: "#D0CCC5",
    text: "#1A1917", text2: "#5C5A55", text3: "#9C9A95",
    primary: "#7C6AAE",
    primarySoft: "rgba(124,106,174,0.08)", primarySoft2: "rgba(124,106,174,0.15)",
    accent: "#C4A6FF",
    success: "#3DAA6D", successSoft: "rgba(61,170,109,0.10)",
    warning: "#D49A20", warningSoft: "rgba(212,154,32,0.10)",
    error: "#E05448", errorSoft: "rgba(224,84,72,0.10)",
    info: "#3B82CE", infoSoft: "rgba(59,130,206,0.10)",
    muted: "#9C9A95", mutedSoft: "rgba(156,154,149,0.12)",
    shadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
    navBg: "rgba(250,250,248,0.88)", codeBg: "#F7F5F2",
  },
  dark: {
    bg: "#0F0F12", bgAlt: "#17171C", bgCard: "#1C1C22",
    border: "#2A2A32", borderHover: "#3A3A44",
    text: "#EDEDEB", text2: "#A5A5A0", text3: "#6C6C68",
    primary: "#A08CD6",
    primarySoft: "rgba(160,140,214,0.10)", primarySoft2: "rgba(160,140,214,0.18)",
    accent: "#C4A6FF",
    success: "#4EC87A", successSoft: "rgba(78,200,122,0.12)",
    warning: "#F0B840", warningSoft: "rgba(240,184,64,0.12)",
    error: "#F06458", errorSoft: "rgba(240,100,88,0.12)",
    info: "#5B9FE8", infoSoft: "rgba(91,159,232,0.12)",
    muted: "#6C6C68", mutedSoft: "rgba(108,108,104,0.15)",
    shadow: "0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)",
    navBg: "rgba(15,15,18,0.88)", codeBg: "#14141A",
  },
};

const bb = { display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 500, padding: "4px 9px", borderRadius: 6, lineHeight: 1, whiteSpace: "nowrap" };

const DIFFS = {
  "브론즈": { bg: "rgba(173,86,0,.12)", color: "#C06800", border: "rgba(173,86,0,.25)" },
  "실버": { bg: "rgba(67,95,122,.12)", color: "#5A7B99", border: "rgba(67,95,122,.25)" },
  "골드": { bg: "rgba(236,144,3,.12)", color: "#D48A00", border: "rgba(236,144,3,.25)" },
  "플래티넘": { bg: "rgba(39,226,164,.12)", color: "#20C490", border: "rgba(39,226,164,.25)" },
};

const problems = [
  { id: 1, name: "두 수의 합", diff: "브론즈", week: "3월1주차", subs: 7, reviewed: 4, closed: true },
  { id: 2, name: "이진 탐색 트리", diff: "골드", week: "3월1주차", subs: 5, reviewed: 2, closed: true },
  { id: 3, name: "최단 경로 (다익스트라)", diff: "플래티넘", week: "3월1주차", subs: 3, reviewed: 0, closed: false, remain: "2일" },
];

const members = [
  { name: "김민수", avatar: "김", lang: "Python", time: "3월 4일 14:22", stars: 2, comments: 3, isMe: true },
  { name: "이서연", avatar: "이", lang: "Python", time: "3월 4일 16:10", stars: 3, comments: 5 },
  { name: "박지훈", avatar: "박", lang: "Java", time: "3월 5일 09:33", stars: 1, comments: 2 },
  { name: "최유나", avatar: "최", lang: "C++", time: "3월 5일 11:47", stars: 2, comments: 1 },
  { name: "정도현", avatar: "정", lang: "Python", time: "3월 5일 22:01", stars: 0, comments: 0 },
];

const sampleCode = `def two_sum(nums, target):
    """해시맵을 활용한 O(n) 풀이"""
    if not nums or len(nums) < 2:
        return None

    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i

    raise ValueError("No solution found")`.split("\n");

const aiStars = [
  { line: 1, label: "독스트링", desc: "접근 방식을 간결하게 설명해 가독성이 뛰어납니다." },
  { line: 7, label: "complement 패턴", desc: "보수를 먼저 계산하는 패턴으로 한 번의 순회에 O(n) 해결. 직관적인 변수명도 좋습니다." },
];

const lineComments = {
  2: [{ author: "이서연", avatar: "이", text: "입력 검증을 넣은 게 좋네요! 저는 빼먹었는데 배워갑니다.", time: "3월 6일 09:30" }],
  7: [
    { author: "최유나", avatar: "최", text: "complement라는 이름이 직관적이에요. 저는 diff로 했는데 이게 더 낫네요.", time: "3월 6일 11:02" },
    { author: "정도현", avatar: "정", text: "동의! 변수명이 로직을 설명해주는 느낌입니다.", time: "3월 6일 14:30" },
  ],
};

const feedbacks = [
  { author: "이서연", avatar: "이", text: "해시맵 패턴이 깔끔해요! 저는 이중 for문으로 풀었는데 이 방식이 훨씬 효율적이네요. complement 변수명도 배워갑니다.", time: "3월 6일 09:45", likes: 3 },
  { author: "박지훈", avatar: "박", text: "코드가 간결하고 읽기 좋아요. 입력 검증도 있고요. 실무에서도 이렇게 짜면 좋겠네요.", time: "3월 6일 10:20", likes: 2 },
];

const studyNotes = [
  { author: "김민수", avatar: "김", time: "3월 7일 15:30", text: "오늘 스터디에서 O(n) vs O(n²) 시간복잡도를 비교했습니다. 해시맵 패턴을 모두 숙지합시다." },
  { author: "이서연", avatar: "이", time: "3월 7일 15:45", text: "complement 네이밍 컨벤션이 좋다는 의견이 많았어요. 앞으로 변수명을 더 신경쓰기로!" },
];
const actionItems = [
  { text: "입력 검증 추가 연습", assignee: "전체", done: false },
  { text: "해시맵 관련 문제 3개 추가 풀이", assignee: "이서연", done: false },
  { text: "엣지케이스 정리 문서 작성", assignee: "박지훈", done: true },
];

function Logo({ size = 28, primary, accent }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill={`url(#lG${size})`} />
      <defs><linearGradient id={`lG${size}`} x1="0" y1="0" x2="40" y2="40"><stop stopColor={primary} /><stop offset="1" stopColor={accent} /></linearGradient></defs>
      <line x1="14" y1="14" x2="26" y2="14" stroke="#fff" strokeWidth="1.5" opacity=".4" />
      <line x1="14" y1="14" x2="14" y2="26" stroke="#fff" strokeWidth="1.5" opacity=".4" />
      <line x1="14" y1="26" x2="26" y2="26" stroke="#fff" strokeWidth="1.5" opacity=".4" />
      <line x1="26" y1="14" x2="26" y2="26" stroke="#fff" strokeWidth="1.5" opacity=".4" />
      <line x1="14" y1="14" x2="26" y2="26" stroke="#fff" strokeWidth="1.5" opacity=".3" />
      <circle cx="14" cy="14" r="3.5" fill="#fff" /><circle cx="26" cy="14" r="3" fill="#fff" opacity=".7" />
      <circle cx="14" cy="26" r="3" fill="#fff" opacity=".7" /><circle cx="26" cy="26" r="3.5" fill="#fff" />
    </svg>
  );
}

function BackBtn({ onClick, label, t }) {
  return (
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: t.text3, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", marginBottom: 8, padding: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      {label}
    </button>
  );
}

/* ══════════════════════════════════════════
   1. PROBLEM LIST
   ══════════════════════════════════════════ */
function ProblemListView({ t, mounted, onSelect }) {
  const card = { background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow };
  const fade = (d) => ({ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)", transition: `all .5s cubic-bezier(.16,1,.3,1) ${d}s` });

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 28, ...fade(0) }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -.5, marginBottom: 6 }}>코드 리뷰</h1>
        <p style={{ fontSize: 13, color: t.text3 }}>문제별로 스터디원들의 풀이를 확인하고 리뷰하세요</p>
      </div>

      <div style={{ ...card, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8, background: t.infoSoft, border: `1px solid rgba(59,130,206,0.15)`, ...fade(.04) }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.info} strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span style={{ fontSize: 12, color: t.text2 }}>마감 전 코드는 본인만 볼 수 있으며, 마감 후 전체 공개됩니다.</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, ...fade(.08) }}>
        {problems.map(p => {
          const dc = DIFFS[p.diff] || DIFFS["브론즈"];
          return (
            <div key={p.id} onClick={() => p.closed && onSelect(p)} style={{
              ...card, padding: "16px 20px", cursor: p.closed ? "pointer" : "default",
              transition: "all .2s", opacity: p.closed ? 1 : .55,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
              onMouseEnter={e => { if (p.closed) e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: t.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", color: t.primary }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{ ...bb, fontWeight: 600, background: dc.bg, color: dc.color, border: `1px solid ${dc.border}` }}>{p.diff}</span>
                    <span style={{ ...bb, background: t.primarySoft, color: t.primary }}>{p.week}</span>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: t.text2 }}>{p.subs}명 제출</div>
                  <div style={{ fontSize: 11, color: t.text3, marginTop: 1 }}>{p.reviewed}개 리뷰</div>
                </div>
                {!p.closed ? (
                  <span style={{ ...bb, background: t.warningSoft, color: t.warning, gap: 3 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    {p.remain}
                  </span>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.text3} strokeWidth="1.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   2. PROBLEM DETAIL (멤버 목록 + 스터디 노트)
   ══════════════════════════════════════════ */
function ProblemDetailView({ problem, t, onBack, onSelectMember }) {
  const card = { background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <BackBtn onClick={onBack} label="문제 목록" t={t} />

      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -.5, marginBottom: 6 }}>{problem.name}</h1>
        <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
          <span style={{ ...bb, fontWeight: 600, background: DIFFS[problem.diff]?.bg, color: DIFFS[problem.diff]?.color, border: `1px solid ${DIFFS[problem.diff]?.border}` }}>{problem.diff}</span>
          <span style={{ ...bb, background: t.primarySoft, color: t.primary }}>{problem.week}</span>
          <span style={{ ...bb, background: t.successSoft, color: t.success }}>{problem.subs}명 제출</span>
        </div>
      </div>

      {/* Members */}
      <div style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          <span style={{ fontSize: 14, fontWeight: 600 }}>제출 목록</span>
        </div>
        {members.map((m, i) => (
          <div key={i} onClick={() => onSelectMember(m)} style={{
            padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: i < members.length - 1 ? `1px solid ${t.border}` : "none",
            cursor: "pointer", transition: "background .15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = t.primarySoft}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: m.isMe ? `linear-gradient(135deg,${t.primary},${t.accent})` : t.bgAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: m.isMe ? "#fff" : t.text2 }}>{m.avatar}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
                  {m.name}
                  {m.isMe && <span style={{ ...bb, fontSize: 9, padding: "2px 6px", background: t.primarySoft, color: t.primary }}>나</span>}
                </div>
                <div style={{ fontSize: 11, color: t.text3, marginTop: 1 }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{m.lang}</span>
                  <span style={{ margin: "0 5px", opacity: .3 }}>·</span>{m.time}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {m.stars > 0 && <span style={{ ...bb, background: t.successSoft, color: t.success, gap: 3 }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/></svg>{m.stars}</span>}
              {m.comments > 0 && <span style={{ ...bb, background: t.mutedSoft, color: t.muted, gap: 3 }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>{m.comments}</span>}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.text3} strokeWidth="1.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
        ))}
      </div>

      {/* ── 스터디 노트 ── */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span style={{ fontSize: 14, fontWeight: 600 }}>스터디 노트</span>
          </div>
          <span style={{ ...bb, fontSize: 10, background: t.mutedSoft, color: t.muted }}>전체 공개</span>
        </div>

        {/* Notes */}
        {studyNotes.map((n, i) => (
          <div key={i} style={{ padding: "12px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: t.bgAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: t.text2, flexShrink: 0, marginTop: 2 }}>{n.avatar}</div>
            <div>
              <div style={{ fontSize: 11, color: t.text3 }}><span style={{ fontWeight: 500, color: t.text }}>{n.author}</span> · {n.time}</div>
              <div style={{ fontSize: 12, color: t.text2, lineHeight: 1.6, marginTop: 3 }}>{n.text}</div>
            </div>
          </div>
        ))}

        {/* Action Items */}
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.text2, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.primary} strokeWidth="1.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            액션 아이템
          </div>
          {actionItems.map((a, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${a.done ? t.success : t.border}`, background: a.done ? t.successSoft : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {a.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span style={{ fontSize: 12, color: a.done ? t.text3 : t.text2, textDecoration: a.done ? "line-through" : "none" }}>{a.text}</span>
              </div>
              <span style={{ ...bb, background: t.primarySoft, color: t.primary }}>{a.assignee}</span>
            </div>
          ))}
        </div>

        {/* New note input */}
        <div style={{ padding: "12px 20px", display: "flex", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: `linear-gradient(135deg,${t.primary},${t.accent})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "#fff", flexShrink: 0 }}>김</div>
          <input placeholder="스터디 노트를 남겨보세요..." style={{ flex: 1, height: 34, padding: "0 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.bgAlt, color: t.text, fontSize: 12, fontFamily: "inherit", outline: "none" }} />
          <button style={{ height: 34, padding: "0 14px", borderRadius: 8, background: t.primary, color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>등록</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   3. CODE REVIEW DETAIL (2칸 레이아웃)
   ══════════════════════════════════════════ */
function CodeReviewView({ member, t, onBack }) {
  const [selectedLine, setSelectedLine] = useState(null);
  const [panelTab, setPanelTab] = useState("comments");
  const [newComment, setNewComment] = useState("");
  const card = { background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow };

  const commentLineNums = Object.keys(lineComments).map(Number);
  const starLineNums = aiStars.map(s => s.line);

  // When a star line is selected, switch to highlights tab
  const handleLineClick = (i) => {
    setSelectedLine(selectedLine === i ? null : i);
    if (starLineNums.includes(i)) setPanelTab("highlights");
    else if (commentLineNums.includes(i)) setPanelTab("comments");
    else setPanelTab("comments");
  };

  const activeStar = selectedLine !== null ? aiStars.find(s => s.line === selectedLine) : null;
  const activeComments = selectedLine !== null ? lineComments[selectedLine] : null;

  return (
    <div>
      <BackBtn onClick={onBack} label="제출 목록" t={t} />

      {/* Author bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: member.isMe ? `linear-gradient(135deg,${t.primary},${t.accent})` : t.bgAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: member.isMe ? "#fff" : t.text2 }}>{member.avatar}</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -.3 }}>{member.name}의 풀이</div>
          <div style={{ fontSize: 11, color: t.text3 }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{member.lang}</span>
            <span style={{ margin: "0 5px", opacity: .3 }}>·</span>{member.time}
          </div>
        </div>
      </div>

      {/* 2-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 14, alignItems: "start" }}>
        {/* LEFT: Code */}
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "8px 14px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: t.text2, fontFamily: "'JetBrains Mono',monospace" }}>solution.py</span>
            <span style={{ fontSize: 10, color: t.text3 }}>{sampleCode.length}줄 · 라인 클릭으로 리뷰</span>
          </div>
          <div style={{ background: t.codeBg, overflow: "auto" }}>
            {sampleCode.map((line, i) => {
              const hasStar = starLineNums.includes(i);
              const hasComment = commentLineNums.includes(i);
              const isSelected = selectedLine === i;

              return (
                <div key={i} onClick={() => handleLineClick(i)} style={{
                  display: "flex", cursor: "pointer", transition: "background .1s",
                  background: isSelected ? t.primarySoft : hasStar ? t.successSoft : "transparent",
                  borderLeft: isSelected ? `3px solid ${t.primary}` : hasStar ? `3px solid ${t.success}` : hasComment ? `3px solid ${t.primary}` : "3px solid transparent",
                }}
                  onMouseEnter={e => { if (!isSelected && !hasStar) e.currentTarget.style.background = t.primarySoft; }}
                  onMouseLeave={e => { if (!isSelected && !hasStar) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ width: 36, minWidth: 36, textAlign: "right", paddingRight: 10, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: isSelected ? t.primary : t.text3, lineHeight: "26px", opacity: isSelected ? .9 : .4, userSelect: "none", fontWeight: isSelected ? 600 : 400 }}>{i + 1}</span>
                  <pre style={{ margin: 0, flex: 1, padding: "0 10px", fontFamily: "'JetBrains Mono',monospace", fontSize: 13, lineHeight: "26px", color: isSelected ? t.text : t.text2 }}>{line || " "}</pre>
                  <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "0 8px" }}>
                    {hasStar && <svg width="12" height="12" viewBox="0 0 24 24" fill={t.success} stroke={t.success} strokeWidth="1"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/></svg>}
                    {hasComment && <span style={{ fontSize: 10, color: t.primary, fontWeight: 500, display: "flex", alignItems: "center", gap: 2 }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>{lineComments[i]?.length}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Review Panel */}
        <div style={{ position: "sticky", top: 72 }}>
          {/* Panel tabs */}
          <div style={{ display: "flex", gap: 3, marginBottom: 10, background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 9, padding: 3 }}>
            {[
              { key: "comments", label: "댓글" },
              { key: "highlights", label: "본받을 점" },
              { key: "feedback", label: "전체 피드백" },
            ].map(tb => (
              <button key={tb.key} onClick={() => setPanelTab(tb.key)} style={{
                flex: 1, height: 30, borderRadius: 7, border: "none",
                background: panelTab === tb.key ? t.primary : "transparent",
                color: panelTab === tb.key ? "#fff" : t.text3,
                fontSize: 11, fontWeight: panelTab === tb.key ? 600 : 400,
                cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
              }}>{tb.label}</button>
            ))}
          </div>

          {/* ── Comments panel ── */}
          {panelTab === "comments" && (
            <div style={{ ...card, padding: 16 }}>
              {selectedLine === null ? (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t.text3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 8px", opacity: .4 }}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                  <div style={{ fontSize: 12, color: t.text3 }}>코드 라인을 클릭하면<br/>댓글을 확인하고 남길 수 있어요</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 11, color: t.text3, marginBottom: 10, fontFamily: "'JetBrains Mono',monospace" }}>Line {selectedLine + 1}</div>
                  {activeComments ? activeComments.map((c, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, padding: "8px 0", borderBottom: `1px solid ${t.border}` }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: t.bgAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: t.text2, flexShrink: 0 }}>{c.avatar}</div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 500 }}>{c.author} <span style={{ color: t.text3, fontWeight: 400 }}>{c.time}</span></div>
                        <div style={{ fontSize: 12, color: t.text2, lineHeight: 1.5, marginTop: 3 }}>{c.text}</div>
                      </div>
                    </div>
                  )) : <div style={{ fontSize: 12, color: t.text3, padding: "8px 0" }}>아직 댓글이 없습니다</div>}
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="댓글 남기기..." style={{ flex: 1, height: 32, padding: "0 10px", borderRadius: 7, border: `1px solid ${t.border}`, background: t.bgAlt, color: t.text, fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                    <button style={{ height: 32, padding: "0 10px", borderRadius: 7, background: t.primary, color: "#fff", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>등록</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Highlights panel ── */}
          {panelTab === "highlights" && (
            <div style={{ ...card, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill={t.success} stroke={t.success} strokeWidth="1"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/></svg>
                <span style={{ fontSize: 12, fontWeight: 600 }}>AI가 찾은 본받을 점</span>
                <span style={{ ...bb, fontSize: 9, padding: "2px 6px", background: t.successSoft, color: t.success }}>전체 공개</span>
              </div>
              {activeStar ? (
                <div style={{ padding: "10px 12px", borderRadius: 8, background: t.successSoft, borderLeft: `3px solid ${t.success}` }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.success, marginBottom: 3 }}>Line {activeStar.line + 1} · {activeStar.label}</div>
                  <div style={{ fontSize: 12, color: t.text2, lineHeight: 1.5 }}>{activeStar.desc}</div>
                </div>
              ) : (
                <div>
                  {aiStars.map((s, i) => (
                    <div key={i} onClick={() => { setSelectedLine(s.line); }} style={{
                      padding: "10px 12px", borderRadius: 8, background: t.successSoft,
                      borderLeft: `3px solid ${t.success}`, marginBottom: i < aiStars.length - 1 ? 8 : 0,
                      cursor: "pointer", transition: "opacity .15s",
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.success, marginBottom: 2 }}>Line {s.line + 1} · {s.label}</div>
                      <div style={{ fontSize: 12, color: t.text2, lineHeight: 1.5 }}>{s.desc}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Feedback panel ── */}
          {panelTab === "feedback" && (
            <div style={{ ...card, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>전체 피드백</div>
              {feedbacks.map((f, i) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: `1px solid ${t.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 5, background: t.bgAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, color: t.text2 }}>{f.avatar}</div>
                      <span style={{ fontSize: 11, fontWeight: 500 }}>{f.author}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 10, color: t.text3 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/></svg>
                      {f.likes}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: t.text2, lineHeight: 1.55 }}>{f.text}</div>
                </div>
              ))}
              <textarea placeholder="전체 피드백을 남겨보세요..." style={{ width: "100%", minHeight: 60, padding: "8px 10px", borderRadius: 7, border: `1px solid ${t.border}`, background: t.bgAlt, color: t.text, fontSize: 12, fontFamily: "inherit", outline: "none", resize: "vertical", lineHeight: 1.5, marginTop: 10 }} />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                <button style={{ height: 30, padding: "0 12px", borderRadius: 7, background: t.primary, color: "#fff", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>등록</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN
   ══════════════════════════════════════════ */
export default function AlgoSuCodeReview() {
  const [mode, setMode] = useState("dark");
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState("problems");
  const [selProblem, setSelProblem] = useState(null);
  const [selMember, setSelMember] = useState(null);
  const t = THEMES[mode];

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  return (
    <div style={{ fontFamily: "'Sora','Noto Sans KR',-apple-system,sans-serif", background: t.bg, color: t.text, minHeight: "100vh", transition: "background .4s, color .4s" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0}::selection{background:${t.primarySoft2}}input:focus,textarea:focus{border-color:${t.primary} !important;outline:none}`}</style>

      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: t.navBg, backdropFilter: "blur(20px) saturate(180%)", borderBottom: `1px solid ${t.border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => { setView("problems"); setSelProblem(null); setSelMember(null); }}>
            <Logo size={28} primary={t.primary} accent={t.accent} />
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -.5 }}>AlgoSu</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ padding: "5px 12px", borderRadius: 8, background: t.primarySoft, border: `1px solid ${t.border}`, fontSize: 12, fontWeight: 500, color: t.text2 }}>알고리즘 마스터</div>
            <button onClick={() => setMode(m => m === "light" ? "dark" : "light")} style={{ height: 28, padding: "0 8px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", fontSize: 11, fontWeight: 400, display: "flex", alignItems: "center", gap: 4, color: t.text3, fontFamily: "inherit" }}>
              {mode === "light" ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>}
              {mode === "light" ? "라이트" : "다크"}
            </button>
            <div style={{ position: "relative" }}>
              <button style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t.text3 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              </button>
              <div style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: "50%", background: t.error, border: `1.5px solid ${t.bgCard}` }} />
            </div>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg,${t.primary},${t.accent})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>김</div>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: view === "review" ? 1200 : 1200, margin: "0 auto", padding: "28px 24px 60px" }}>
        {view === "review" && selMember ? (
          <CodeReviewView member={selMember} t={t} onBack={() => { setView("detail"); setSelMember(null); }} />
        ) : view === "detail" && selProblem ? (
          <ProblemDetailView problem={selProblem} t={t}
            onBack={() => { setView("problems"); setSelProblem(null); }}
            onSelectMember={m => { setSelMember(m); setView("review"); }}
          />
        ) : (
          <ProblemListView t={t} mounted={mounted}
            onSelect={p => { setSelProblem(p); setView("detail"); }}
          />
        )}
      </main>
    </div>
  );
}
