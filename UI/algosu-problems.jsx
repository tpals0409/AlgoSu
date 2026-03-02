import { useState, useEffect } from "react";

const THEMES = {
  light: {
    bg: "#FAFAF8", bgAlt: "#F3F1EE", bgCard: "#FFFFFF",
    border: "#E8E5E0", borderHover: "#D0CCC5",
    text: "#1A1917", text2: "#5C5A55", text3: "#9C9A95",
    primary: "#7C6AAE", primaryLight: "#9B8BC8",
    primarySoft: "rgba(124,106,174,0.08)", primarySoft2: "rgba(124,106,174,0.15)",
    accent: "#C4A6FF",
    success: "#3DAA6D", successSoft: "rgba(61,170,109,0.10)",
    warning: "#D49A20", warningSoft: "rgba(212,154,32,0.10)",
    error: "#E05448", errorSoft: "rgba(224,84,72,0.10)",
    muted: "#9C9A95", mutedSoft: "rgba(156,154,149,0.12)",
    shadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
    navBg: "rgba(250,250,248,0.88)",
    codeBg: "#F7F5F2", inputBg: "#F3F1EE",
  },
  dark: {
    bg: "#0F0F12", bgAlt: "#17171C", bgCard: "#1C1C22",
    border: "#2A2A32", borderHover: "#3A3A44",
    text: "#EDEDEB", text2: "#A5A5A0", text3: "#6C6C68",
    primary: "#A08CD6", primaryLight: "#B9A6E8",
    primarySoft: "rgba(160,140,214,0.10)", primarySoft2: "rgba(160,140,214,0.18)",
    accent: "#C4A6FF",
    success: "#4EC87A", successSoft: "rgba(78,200,122,0.12)",
    warning: "#F0B840", warningSoft: "rgba(240,184,64,0.12)",
    error: "#F06458", errorSoft: "rgba(240,100,88,0.12)",
    muted: "#6C6C68", mutedSoft: "rgba(108,108,104,0.15)",
    shadow: "0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)",
    navBg: "rgba(15,15,18,0.88)",
    codeBg: "#14141A", inputBg: "#17171C",
  },
};

const DIFFS = {
  "브론즈": { bg: "rgba(173,86,0,.12)", color: "#C06800", border: "rgba(173,86,0,.25)" },
  "실버": { bg: "rgba(67,95,122,.12)", color: "#5A7B99", border: "rgba(67,95,122,.25)" },
  "골드": { bg: "rgba(236,144,3,.12)", color: "#D48A00", border: "rgba(236,144,3,.25)" },
  "플래티넘": { bg: "rgba(39,226,164,.12)", color: "#20C490", border: "rgba(39,226,164,.25)" },
  "다이아": { bg: "rgba(0,180,252,.12)", color: "#00A8E8", border: "rgba(0,180,252,.25)" },
};

const problems = [
  { id: 1, week: "3월1주", name: "두 수의 합", diff: "브론즈", timer: "5d 2h", urgency: "normal", status: "진행 중" },
  { id: 2, week: "3월1주", name: "이진 탐색 트리", diff: "골드", timer: "3:24:10", urgency: "warning", status: "진행 중" },
  { id: 3, week: "3월1주", name: "최단 경로 (다익스트라)", diff: "플래티넘", timer: "12:45", urgency: "critical", status: "진행 중" },
  { id: 4, week: "2월4주", name: "문자열 처리", diff: "실버", timer: "마감", urgency: "expired", status: "종료" },
  { id: 5, week: "2월4주", name: "다이나믹 프로그래밍", diff: "다이아", timer: "마감", urgency: "expired", status: "종료" },
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

const badgeBase = { display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 500, padding: "4px 9px", borderRadius: 6, lineHeight: 1, whiteSpace: "nowrap" };

function DiffBadge({ diff }) {
  const c = DIFFS[diff] || DIFFS["브론즈"];
  return <span style={{ ...badgeBase, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{diff}</span>;
}

function TimerBadge({ timer, urgency, t }) {
  const styles = {
    normal: { bg: t.primarySoft, color: t.text2 },
    warning: { bg: t.warningSoft, color: t.warning },
    critical: { bg: t.errorSoft, color: t.error },
    expired: { bg: t.mutedSoft, color: t.muted },
  };
  const s = styles[urgency] || styles.normal;
  return (
    <span style={{
      ...badgeBase, gap: 3, fontFamily: "'JetBrains Mono',monospace",
      background: s.bg, color: s.color,
      animation: urgency === "critical" ? "pulse-dot 1.5s infinite" : "none",
      textDecoration: urgency === "expired" ? "line-through" : "none",
      opacity: urgency === "expired" ? .6 : 1,
    }}>⏱ {timer}</span>
  );
}

function StatusBadge({ status, t }) {
  const isActive = status === "진행 중";
  return <span style={{ ...badgeBase, background: isActive ? t.successSoft : t.mutedSoft, color: isActive ? t.success : t.muted }}>{status}</span>;
}

/* ─── PROBLEM LIST VIEW ─── */
function ProblemList({ t, onSelect, onCreateClick, mounted }) {
  const [search, setSearch] = useState("");
  const [diffFilter, setDiffFilter] = useState("전체");
  const [weekFilter, setWeekFilter] = useState("전체");

  const filtered = problems.filter(p => {
    if (search && !p.name.includes(search)) return false;
    if (diffFilter !== "전체" && p.diff !== diffFilter) return false;
    if (weekFilter !== "전체" && p.week !== weekFilter) return false;
    return true;
  });

  const selectStyle = {
    height: 34, padding: "0 28px 0 10px", borderRadius: 8,
    border: `1px solid ${t.border}`, background: t.inputBg, color: t.text,
    fontSize: 12, fontFamily: "inherit", cursor: "pointer", outline: "none",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(t.text3)}' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -.5 }}>문제</h1>
        <button onClick={onCreateClick} style={{ height: 36, padding: "0 16px", borderRadius: 9, background: t.primary, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          문제 추가
        </button>
      </div>

      {/* Filters */}
      <div style={{
        background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12,
        padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: 8,
        marginBottom: 16, boxShadow: t.shadow,
      }}>
        <div style={{ position: "relative", flex: "1 1 160px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.text3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 10, top: 10 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="문제 검색..." style={{
            width: "100%", height: 34, padding: "0 10px 0 30px", borderRadius: 8,
            border: `1px solid ${t.border}`, background: t.inputBg, color: t.text,
            fontSize: 12, fontFamily: "inherit", outline: "none",
          }} />
        </div>
        <select value={diffFilter} onChange={e => setDiffFilter(e.target.value)} style={selectStyle}>
          <option>전체</option><option>브론즈</option><option>실버</option><option>골드</option><option>플래티넘</option><option>다이아</option>
        </select>
        <select value={weekFilter} onChange={e => setWeekFilter(e.target.value)} style={selectStyle}>
          <option>전체</option><option>3월1주</option><option>2월4주</option>
        </select>
        <button onClick={() => { setSearch(""); setDiffFilter("전체"); setWeekFilter("전체"); }} style={{ height: 34, padding: "0 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: "transparent", color: t.text3, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>초기화</button>
      </div>

      {/* Table */}
      <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, overflow: "hidden", boxShadow: t.shadow }}>
        {/* Header row */}
        <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 80px 100px 72px", borderBottom: `1px solid ${t.border}` }}>
          {["주차", "문제", "난이도", "마감", "상태"].map(h => (
            <div key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 600, color: t.text3, textTransform: "uppercase", letterSpacing: .5 }}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: t.text3 }}>검색 결과가 없습니다</div>
          </div>
        ) : filtered.map((p, i) => (
          <div key={p.id} onClick={() => onSelect(p)} style={{
            display: "grid", gridTemplateColumns: "64px 1fr 80px 100px 72px",
            borderBottom: i < filtered.length - 1 ? `1px solid ${t.border}` : "none",
            cursor: "pointer", transition: "background .15s",
            opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(8px)",
            transition: `all .4s cubic-bezier(.16,1,.3,1) ${.1 + i * .04}s`,
          }}
            onMouseEnter={e => e.currentTarget.style.background = t.primarySoft}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ padding: "12px 14px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: t.text3, display: "flex", alignItems: "center" }}>{p.week}</div>
            <div style={{ padding: "12px 14px", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center" }}>{p.name}</div>
            <div style={{ padding: "12px 14px", display: "flex", alignItems: "center" }}><DiffBadge diff={p.diff} /></div>
            <div style={{ padding: "12px 14px", display: "flex", alignItems: "center" }}><TimerBadge timer={p.timer} urgency={p.urgency} t={t} /></div>
            <div style={{ padding: "12px 14px", display: "flex", alignItems: "center" }}><StatusBadge status={p.status} t={t} /></div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 16 }}>
        {["‹", "1", "2", "3", "›"].map((p, i) => (
          <button key={i} style={{
            minWidth: 32, height: 32, borderRadius: 8,
            border: `1px solid ${p === "1" ? t.primary : t.border}`,
            background: p === "1" ? t.primary : "transparent",
            color: p === "1" ? "#fff" : t.text2,
            fontSize: 12, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{p}</button>
        ))}
      </div>
    </div>
  );
}

/* ─── PROBLEM DETAIL VIEW ─── */
function ProblemDetail({ problem, t, onBack }) {
  const [lang, setLang] = useState("Python");
  const [code, setCode] = useState(`def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []`);

  const card = { background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow };

  return (
    <div>
      {/* Back */}
      <button onClick={onBack} style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 12, color: t.text3, background: "none", border: "none",
        cursor: "pointer", fontFamily: "inherit", marginBottom: 8, padding: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        문제 목록
      </button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -.5 }}>{problem.name}</h1>
        <button style={{ height: 34, padding: "0 14px", borderRadius: 9, background: "transparent", border: `1px solid ${t.border}`, color: t.text2, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          수정
        </button>
      </div>

      {/* Problem Info */}
      <div style={{ ...card, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          <span style={{ ...badgeBase, background: t.primarySoft, color: t.primary, fontWeight: 500 }}>{problem.week}</span>
          <DiffBadge diff={problem.diff} />
          <StatusBadge status={problem.status} t={t} />
          <TimerBadge timer={problem.timer} urgency={problem.urgency} t={t} />
        </div>
        <p style={{ fontSize: 13, color: t.text2, lineHeight: 1.7, marginBottom: 14 }}>
          정수 배열 nums와 정수 target이 주어질 때, 합이 target이 되는 두 수의 인덱스를 반환하세요.
          각 입력에는 정확히 하나의 해가 존재하며, 같은 요소를 두 번 사용할 수 없습니다.
        </p>
        <div style={{ fontSize: 11, color: t.text3, fontWeight: 500, marginBottom: 6 }}>허용 언어</div>
        <div style={{ display: "flex", gap: 6 }}>
          {["Python", "JavaScript", "Java", "C++"].map(l => (
            <span key={l} style={{ ...badgeBase, background: t.mutedSoft, color: t.muted }}>{l}</span>
          ))}
        </div>
      </div>

      {/* Code Editor */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        {/* Editor header */}
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <select value={lang} onChange={e => setLang(e.target.value)} style={{
              height: 30, padding: "0 24px 0 8px", borderRadius: 7,
              border: `1px solid ${t.border}`, background: t.inputBg, color: t.text,
              fontSize: 12, fontFamily: "inherit", cursor: "pointer", outline: "none",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(t.text3)}' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center",
            }}>
              <option>Python</option><option>JavaScript</option><option>Java</option><option>C++</option>
            </select>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: t.success }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              저장됨
            </span>
          </div>
          <span style={{ fontSize: 11, color: t.text3 }}>마감: 2026-03-08 23:59:59</span>
        </div>

        {/* Code area */}
        <div style={{ position: "relative" }}>
          {/* Line numbers */}
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: 40,
            background: t.codeBg, borderRight: `1px solid ${t.border}`,
            padding: "16px 0", display: "flex", flexDirection: "column",
            alignItems: "center",
          }}>
            {code.split("\n").map((_, i) => (
              <div key={i} style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: t.text3, lineHeight: "22px", opacity: .5 }}>{i + 1}</div>
            ))}
          </div>
          <textarea value={code} onChange={e => setCode(e.target.value)} style={{
            width: "100%", minHeight: 220, padding: "16px 16px 16px 52px",
            border: "none", background: t.codeBg, color: t.text,
            fontFamily: "'JetBrains Mono',monospace", fontSize: 13, lineHeight: "22px",
            resize: "vertical", outline: "none",
          }} />
        </div>

        {/* Submit bar */}
        <div style={{
          padding: "12px 16px", borderTop: `1px solid ${t.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 11, color: t.text3, fontFamily: "'JetBrains Mono',monospace" }}>{code.length}자</span>
          <button style={{
            height: 38, padding: "0 20px", borderRadius: 9,
            background: t.primary, color: "#fff", border: "none",
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            제출하기
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── PROBLEM CREATE VIEW ─── */
function ProblemCreate({ t, onBack }) {
  const [bojNum, setBojNum] = useState("1000");
  const [searched, setSearched] = useState(true);
  const [title, setTitle] = useState("A+B");
  const [desc, setDesc] = useState("두 정수 A와 B를 입력받은 다음, A+B를 출력하는 프로그램을 작성하시오.");
  const [diff, setDiff] = useState("브론즈");
  const [week, setWeek] = useState("3월1주차");
  const [deadline, setDeadline] = useState("일");
  const [sourceUrl, setSourceUrl] = useState("https://www.acmicpc.net/problem/1000");
  const [langs, setLangs] = useState(["Python", "JavaScript", "C++"]);
  const allLangs = ["Python", "JavaScript", "Java", "C++", "Go"];

  const card = { background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow };
  const inputStyle = {
    width: "100%", height: 40, padding: "0 12px", borderRadius: 8,
    border: `1px solid ${t.border}`, background: t.inputBg, color: t.text,
    fontSize: 13, fontFamily: "inherit", outline: "none", transition: "border-color .2s",
  };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 500, color: t.text2, marginBottom: 6 };
  const selectStyle = {
    ...inputStyle, cursor: "pointer", appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(t.text3)}' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: 28,
  };
  const sectionTitle = (icon, text) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: t.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", color: t.primary }}>{icon}</div>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{text}</span>
    </div>
  );

  const toggleLang = (l) => setLangs(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      {/* Back */}
      <button onClick={onBack} style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 12, color: t.text3, background: "none", border: "none",
        cursor: "pointer", fontFamily: "inherit", marginBottom: 8, padding: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        문제 목록
      </button>

      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -.5, marginBottom: 6 }}>문제 추가</h1>
        <p style={{ fontSize: 13, color: t.text3 }}>백준 문제를 검색하고 스터디에 추가하세요</p>
      </div>

      {/* ── Card 1: 백준 검색 ── */}
      <div style={{ ...card, padding: 24, marginBottom: 14 }}>
        {sectionTitle(
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
          "백준 문제 검색"
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input value={bojNum} onChange={e => setBojNum(e.target.value)} placeholder="문제 번호 (예: 1000)" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={() => setSearched(true)} style={{
            height: 40, padding: "0 20px", borderRadius: 8,
            background: t.primary, color: "#fff", border: "none",
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            whiteSpace: "nowrap",
          }}>검색</button>
        </div>

        {searched && (
          <div style={{
            marginTop: 12, padding: "14px 16px", borderRadius: 10,
            background: t.primarySoft, border: `1px solid ${t.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: t.bgCard, border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>A+B</div>
                <div style={{ fontSize: 11, color: t.text3, marginTop: 1 }}>solved.ac 레벨: Bronze V</div>
              </div>
            </div>
            <span style={{ fontSize: 11, color: t.primary, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 500 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              BOJ
            </span>
          </div>
        )}
      </div>

      {/* ── Card 2: 기본 정보 ── */}
      <div style={{ ...card, padding: 24, marginBottom: 14 }}>
        {sectionTitle(
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
          "기본 정보"
        )}

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>제목 <span style={{ color: t.error, fontSize: 10 }}>필수</span></label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>설명</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} style={{
            ...inputStyle, height: "auto", minHeight: 88, padding: "10px 12px",
            resize: "vertical", lineHeight: 1.6,
          }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>난이도 <span style={{ color: t.error, fontSize: 10 }}>필수</span></label>
            <select value={diff} onChange={e => setDiff(e.target.value)} style={selectStyle}>
              <option>브론즈</option><option>실버</option><option>골드</option><option>플래티넘</option><option>다이아</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>주차 <span style={{ color: t.error, fontSize: 10 }}>필수</span></label>
            <select value={week} onChange={e => setWeek(e.target.value)} style={selectStyle}>
              <option>3월1주차</option><option>3월2주차</option><option>3월3주차</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Card 3: 마감 & 설정 ── */}
      <div style={{ ...card, padding: 24, marginBottom: 14 }}>
        {sectionTitle(
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
          "마감 & 설정"
        )}

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>마감 요일 <span style={{ color: t.error, fontSize: 10 }}>필수</span></label>
          <div style={{ display: "flex", gap: 6 }}>
            {["월", "화", "수", "목", "금", "토", "일"].map(day => {
              const sel = deadline === day;
              return (
                <button key={day} onClick={() => setDeadline(day)} style={{
                  flex: 1, height: 40, borderRadius: 8, cursor: "pointer",
                  border: `1px solid ${sel ? t.primary : t.border}`,
                  background: sel ? t.primarySoft : "transparent",
                  color: sel ? t.primary : t.text3,
                  fontSize: 13, fontWeight: sel ? 600 : 400,
                  fontFamily: "inherit", transition: "all .15s",
                }}>{day}</button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: t.text3, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            {week} {deadline}요일 23:59에 마감됩니다
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>허용 언어</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {allLangs.map(l => {
              const sel = langs.includes(l);
              return (
                <button key={l} onClick={() => toggleLang(l)} style={{
                  ...badgeBase, cursor: "pointer", gap: 4, padding: "6px 12px",
                  border: `1px solid ${sel ? t.primary : t.border}`,
                  background: sel ? t.primarySoft : "transparent",
                  color: sel ? t.primary : t.text3, transition: "all .15s",
                }}>
                  {sel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  {l}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label style={labelStyle}>출처 URL</label>
          <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} style={{ ...inputStyle, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }} />
        </div>
      </div>

      {/* ── Submit ── */}
      <button style={{
        width: "100%", height: 46, borderRadius: 12,
        background: t.primary, color: "#fff", border: "none",
        fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        boxShadow: `0 4px 16px rgba(124,106,174,.25)`,
        transition: "opacity .2s",
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        문제 생성
      </button>

      <div style={{ height: 40 }} />
    </div>
  );
}

/* ─── MAIN ─── */
export default function AlgoSuProblems() {
  const [mode, setMode] = useState("dark");
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState("list"); // "list" | "detail" | "create"
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [showNotif, setShowNotif] = useState(false);
  const t = THEMES[mode];

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  const handleSelect = (p) => { setSelectedProblem(p); setView("detail"); };
  const handleBack = () => { setView("list"); setSelectedProblem(null); };

  return (
    <div style={{ fontFamily: "'Sora','Noto Sans KR',-apple-system,sans-serif", background: t.bg, color: t.text, minHeight: "100vh", transition: "background .4s, color .4s" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0}::selection{background:${t.primarySoft2}}@keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:.4}}textarea:focus{outline:none}input:focus,select:focus{border-color:${t.primary} !important}`}</style>

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: t.navBg, backdropFilter: "blur(20px) saturate(180%)", borderBottom: `1px solid ${t.border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={handleBack}>
            <Logo size={28} primary={t.primary} accent={t.accent} />
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -.5 }}>AlgoSu</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ padding: "5px 12px", borderRadius: 8, background: t.primarySoft, border: `1px solid ${t.border}`, fontSize: 12, fontWeight: 500, color: t.text2, cursor: "pointer" }}>알고리즘 마스터</div>
            <button onClick={() => setMode(m => m === "light" ? "dark" : "light")} style={{ height: 28, padding: "0 8px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", fontSize: 11, fontWeight: 400, display: "flex", alignItems: "center", gap: 4, color: t.text3, fontFamily: "inherit" }}>
              {mode === "light" ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>}
              {mode === "light" ? "라이트" : "다크"}
            </button>
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowNotif(!showNotif)} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t.text3 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              </button>
              <div style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: "50%", background: t.error, border: `1.5px solid ${t.bgCard}` }} />
            </div>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg,${t.primary},${t.accent})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>김</div>
          </div>
        </div>
      </nav>

      {/* CONTENT */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px 60px" }}>
        {view === "create" ? (
          <ProblemCreate t={t} onBack={handleBack} />
        ) : view === "detail" && selectedProblem ? (
          <ProblemDetail problem={selectedProblem} t={t} onBack={handleBack} />
        ) : (
          <ProblemList t={t} onSelect={handleSelect} onCreateClick={() => setView("create")} mounted={mounted} />
        )}
      </main>

      {showNotif && <div onClick={() => setShowNotif(false)} style={{ position: "fixed", inset: 0, zIndex: 50 }} />}
    </div>
  );
}
