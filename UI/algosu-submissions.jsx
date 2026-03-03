import { useState, useEffect, useRef } from "react";

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
    muted: "#9C9A95", mutedSoft: "rgba(156,154,149,0.12)",
    shadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
    navBg: "rgba(250,250,248,0.88)", inputBg: "#F3F1EE", codeBg: "#F7F5F2",
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
    muted: "#6C6C68", mutedSoft: "rgba(108,108,104,0.15)",
    shadow: "0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)",
    navBg: "rgba(15,15,18,0.88)", inputBg: "#17171C", codeBg: "#14141A",
  },
};

const DIFFS = {
  "브론즈": { bg: "rgba(173,86,0,.12)", color: "#C06800", border: "rgba(173,86,0,.25)" },
  "실버": { bg: "rgba(67,95,122,.12)", color: "#5A7B99", border: "rgba(67,95,122,.25)" },
  "골드": { bg: "rgba(236,144,3,.12)", color: "#D48A00", border: "rgba(236,144,3,.25)" },
  "플래티넘": { bg: "rgba(39,226,164,.12)", color: "#20C490", border: "rgba(39,226,164,.25)" },
  "다이아": { bg: "rgba(0,168,232,.12)", color: "#00A8E8", border: "rgba(0,168,232,.25)" },
};

const badgeBase = { display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 500, padding: "4px 9px", borderRadius: 6, lineHeight: 1, whiteSpace: "nowrap" };

const submissions = [
  { id: 1, problem: "두 수의 합", diff: "브론즈", week: "3월1주", lang: "Python", time: "3월 4일 14:22", status: "분석 완료", aiScore: 92 },
  { id: 2, problem: "이진 탐색 트리", diff: "골드", week: "3월1주", lang: "Python", time: "3월 4일 16:10", status: "분석 완료", aiScore: 88 },
  { id: 3, problem: "최단 경로", diff: "플래티넘", week: "3월1주", lang: "Java", time: "3월 5일 09:33", status: "분석 중", aiScore: null },
  { id: 4, problem: "피보나치 수", diff: "브론즈", week: "2월4주", lang: "Python", time: "2월 27일 20:15", status: "분석 완료", aiScore: 95 },
  { id: 5, problem: "DFS와 BFS", diff: "실버", week: "2월4주", lang: "C++", time: "2월 27일 22:30", status: "분석 완료", aiScore: 78 },
  { id: 6, problem: "스택 수열", diff: "실버", week: "2월4주", lang: "Python", time: "2월 28일 11:05", status: "분석 완료", aiScore: 85 },
  { id: 7, problem: "동전 0", diff: "실버", week: "2월3주", lang: "Python", time: "2월 20일 15:42", status: "분석 완료", aiScore: 90 },
  { id: 8, problem: "N과 M", diff: "실버", week: "2월3주", lang: "Java", time: "2월 21일 09:18", status: "분석 완료", aiScore: 72 },
  { id: 9, problem: "RGB거리", diff: "실버", week: "2월2주", lang: "Python", time: "2월 14일 17:33", status: "분석 완료", aiScore: 82 },
  { id: 10, problem: "소수 구하기", diff: "브론즈", week: "2월2주", lang: "Python", time: "2월 13일 10:20", status: "분석 완료", aiScore: 98 },
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

function DiffBadge({ diff }) {
  const c = DIFFS[diff] || DIFFS["브론즈"];
  return <span style={{ ...badgeBase, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{diff}</span>;
}

function StatusBadge({ status, t }) {
  if (status === "분석 완료") return <span style={{ ...badgeBase, background: t.successSoft, color: t.success }}>분석 완료</span>;
  if (status === "분석 중") return <span style={{ ...badgeBase, background: t.warningSoft, color: t.warning, gap: 3 }}>
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1.5s linear infinite" }}><path d="M12 2a10 10 0 0 1 10 10"/></svg>
    분석 중
  </span>;
  return <span style={{ ...badgeBase, background: t.mutedSoft, color: t.muted }}>{status}</span>;
}

function ScoreBadge({ score, t }) {
  if (score === null) return <span style={{ fontSize: 11, color: t.text3 }}>—</span>;
  const color = score >= 90 ? t.success : score >= 70 ? t.warning : t.error;
  const soft = score >= 90 ? t.successSoft : score >= 70 ? t.warningSoft : t.errorSoft;
  return (
    <span style={{ ...badgeBase, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, background: soft, color, gap: 3 }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83"/></svg>
      {score}
    </span>
  );
}

function LangBadge({ lang, t }) {
  return <span style={{ ...badgeBase, background: t.mutedSoft, color: t.muted, fontFamily: "'JetBrains Mono',monospace" }}>{lang}</span>;
}

/* ─── AI RESULT DATA ─── */
const feedbackData = [
  { category: "시간 복잡도", score: 95, grade: "우수", color: "success", comment: "해시맵을 활용한 O(n) 풀이로 최적의 시간 복잡도를 달성했습니다.", lines: [2, 3, 4, 5, 6, 7] },
  { category: "공간 복잡도", score: 88, grade: "우수", color: "success", comment: "O(n) 추가 공간을 사용하지만, 시간-공간 트레이드오프를 적절히 활용했습니다.", lines: [2] },
  { category: "코드 가독성", score: 92, grade: "우수", color: "success", comment: "변수명이 직관적이고 로직이 간결합니다. 독스트링이 추가되면 더 좋겠습니다.", lines: [0, 1, 2, 3] },
  { category: "에러 처리", score: 70, grade: "보통", color: "warning", comment: "ValueError 예외를 사용했으나, 입력 유효성 검증이 추가되면 더 견고해집니다.", lines: [8] },
  { category: "엣지 케이스", score: 60, grade: "개선 필요", color: "warning", comment: "빈 배열, 중복 요소, 음수 입력 등의 엣지 케이스 처리가 부족합니다.", lines: [0, 8] },
];
const originalCode = `def two_sum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i\n    raise ValueError("No solution")`;
const optimizedCode = `from typing import List, Optional, Tuple\n\ndef two_sum(\n    nums: List[int], target: int\n) -> Optional[Tuple[int, int]]:\n    """두 수의 합이 target이 되는 인덱스를 반환"""\n    if not nums or len(nums) < 2:\n        return None\n    seen: dict[int, int] = {}\n    for i, num in enumerate(nums):\n        if (comp := target - num) in seen:\n            return (seen[comp], i)\n        seen[num] = i\n    return None`;

function useAnimVal(target, dur = 1000) {
  const [val, setVal] = useState(0);
  const [go, setGo] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setGo(true); }, { threshold: .2 });
    if (ref.current) o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    if (!go) return; let s = null;
    const step = (ts) => { if (!s) s = ts; const p = Math.min((ts - s) / dur, 1); setVal((1 - Math.pow(1 - p, 3)) * target); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, [go, target, dur]);
  return [ref, val];
}

function ScoreGauge({ score, size = 130, t }) {
  const [ref, animScore] = useAnimVal(score, 1200);
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * animScore) / 100;
  const color = score >= 80 ? t.success : score >= 50 ? t.warning : t.error;
  const label = score >= 80 ? "우수" : score >= 50 ? "보통" : "개선 필요";
  return (
    <div ref={ref} style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={t.border} strokeWidth="8" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset .1s linear" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color, letterSpacing: -2 }}>{Math.round(animScore)}</div>
        <div style={{ fontSize: 11, fontWeight: 500, color: t.text3, marginTop: -2 }}>{label}</div>
      </div>
    </div>
  );
}

function CategoryBar({ item, t, selected, onClick }) {
  const [ref, animW] = useAnimVal(item.score, 800);
  const color = item.color === "success" ? t.success : item.color === "warning" ? t.warning : t.error;
  const softColor = item.color === "success" ? t.successSoft : item.color === "warning" ? t.warningSoft : t.errorSoft;
  return (
    <div ref={ref} onClick={onClick} style={{
      padding: "14px 0", borderBottom: `1px solid ${t.border}`, cursor: "pointer", transition: "all .15s",
      marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20,
      background: selected ? t.primarySoft : "transparent",
      borderLeft: selected ? `3px solid ${t.primary}` : "3px solid transparent",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: selected ? 600 : 500 }}>{item.category}</span>
          <span style={{ ...badgeBase, background: softColor, color }}>{item.grade}</span>
          {selected && <span style={{ fontSize: 10, color: t.primary, display: "flex", alignItems: "center", gap: 3 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            하이라이트
          </span>}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", color }}>{Math.round(animW)}</span>
      </div>
      <div style={{ height: 5, background: t.border, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${animW}%`, background: color, borderRadius: 3, transition: "width .1s linear" }} />
      </div>
      <p style={{ fontSize: 12, color: t.text2, lineHeight: 1.5, marginTop: 6 }}>{item.comment}</p>
    </div>
  );
}

/* ─── AI RESULT VIEW ─── */
function AIResultView({ submission, t, onBack }) {
  const [codeTab, setCodeTab] = useState("original");
  const [selectedCat, setSelectedCat] = useState(null);
  const codeRef = useRef(null);
  const card = { background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow };
  const totalScore = Math.round(feedbackData.reduce((a, b) => a + b.score, 0) / feedbackData.length);
  const dc = DIFFS[submission.diff] || DIFFS["브론즈"];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: t.text3, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", marginBottom: 8, padding: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        제출 목록
      </button>

      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -.5, marginBottom: 6 }}>AI 코드 분석 결과</h1>
        <p style={{ fontSize: 13, color: t.text3 }}>{submission.problem} · {submission.lang} · {submission.time}</p>
      </div>

      {/* Score Overview */}
      <div style={{ ...card, padding: 24, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <ScoreGauge score={totalScore} t={t} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              <span style={{ ...badgeBase, fontWeight: 600, background: dc.bg, color: dc.color, border: `1px solid ${dc.border}` }}>{submission.diff}</span>
              <span style={{ ...badgeBase, background: t.primarySoft, color: t.primary }}>{submission.week}</span>
              <LangBadge lang={submission.lang} t={t} />
              <StatusBadge status={submission.status} t={t} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {[
                { label: "시간 복잡도", value: "O(n)", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
                { label: "공간 복잡도", value: "O(n)", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg> },
                { label: "코드 라인", value: "9줄", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> },
              ].map((s, i) => (
                <div key={i} style={{ padding: "8px 10px", borderRadius: 8, background: t.bgAlt, textAlign: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, fontSize: 10, color: t.text3, marginBottom: 3 }}>{s.icon}{s.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Category Feedback */}
      <div style={{ ...card, padding: "4px 20px", marginBottom: 14 }}>
        {feedbackData.map((item, i) => (
          <CategoryBar key={i} item={item} t={t} selected={selectedCat === i}
            onClick={() => { setSelectedCat(selectedCat === i ? null : i); setCodeTab("original"); setTimeout(() => codeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100); }}
          />
        ))}
      </div>

      {/* AI Summary */}
      <div style={{ ...card, padding: 20, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: t.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", color: t.primary }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83"/></svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600 }}>AI 총평</span>
        </div>
        <p style={{ fontSize: 12, color: t.text2, lineHeight: 1.7 }}>해시맵을 활용한 효율적인 O(n) 풀이입니다. 시간 복잡도와 코드 가독성 모두 우수하며, 변수명도 직관적입니다. 다만 입력 유효성 검증과 엣지 케이스 처리를 보강하면 더 견고한 코드가 될 수 있습니다.</p>
      </div>

      {/* Code Comparison */}
      <div ref={codeRef} style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ display: "flex", borderBottom: `1px solid ${t.border}` }}>
          {[
            { key: "original", label: "내 코드", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> },
            { key: "optimized", label: "최적화 코드", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83"/></svg> },
          ].map(tab => (
            <button key={tab.key} onClick={() => { setCodeTab(tab.key); if (tab.key === "optimized") setSelectedCat(null); }} style={{
              flex: 1, padding: "10px 14px", border: "none",
              background: codeTab === tab.key ? t.primarySoft : "transparent",
              color: codeTab === tab.key ? t.primary : t.text3,
              fontSize: 12, fontWeight: codeTab === tab.key ? 600 : 400,
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              borderBottom: codeTab === tab.key ? `2px solid ${t.primary}` : "2px solid transparent",
              transition: "all .2s",
            }}>{tab.icon}{tab.label}</button>
          ))}
        </div>
        <div style={{ position: "relative" }}>
          {codeTab === "optimized" && (
            <div style={{ position: "absolute", top: 10, right: 10, zIndex: 2, ...badgeBase, background: t.primarySoft, color: t.primary, fontSize: 10, fontWeight: 600, gap: 3 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/></svg>
              AI 추천
            </div>
          )}
          {(() => {
            const codeStr = codeTab === "original" ? originalCode : optimizedCode;
            const lines = codeStr.split("\n");
            const hlLines = selectedCat !== null && codeTab === "original" ? feedbackData[selectedCat].lines : [];
            const hlColor = selectedCat !== null ? (feedbackData[selectedCat].color === "success" ? t.success : t.warning) : t.primary;
            return (
              <div style={{ background: t.codeBg, overflow: "auto", minHeight: 180 }}>
                {lines.map((line, i) => {
                  const isHL = hlLines.includes(i);
                  return (
                    <div key={i} style={{ display: "flex", background: isHL ? (feedbackData[selectedCat]?.color === "success" ? t.successSoft : t.warningSoft) : "transparent", borderLeft: isHL ? `3px solid ${hlColor}` : "3px solid transparent", transition: "all .2s" }}>
                      <span style={{ width: 36, minWidth: 36, textAlign: "right", paddingRight: 10, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: isHL ? hlColor : t.text3, lineHeight: "22px", opacity: isHL ? .8 : .4, userSelect: "none", fontWeight: isHL ? 600 : 400, paddingTop: i === 0 ? 14 : 0, paddingBottom: i === lines.length - 1 ? 14 : 0 }}>{i + 1}</span>
                      <pre style={{ margin: 0, padding: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, lineHeight: "22px", color: isHL ? t.text : t.text2, fontWeight: isHL ? 500 : 400, paddingTop: i === 0 ? 14 : 0, paddingBottom: i === lines.length - 1 ? 14 : 0 }}>{line || " "}</pre>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
        <div style={{ padding: "8px 14px", borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: t.text3, fontFamily: "'JetBrains Mono',monospace" }}>{(codeTab === "original" ? originalCode : optimizedCode).split("\n").length}줄</span>
            {selectedCat !== null && codeTab === "original" && <span style={{ ...badgeBase, fontSize: 10, background: t.primarySoft, color: t.primary, gap: 3 }}>{feedbackData[selectedCat].category} · {feedbackData[selectedCat].lines.length}줄</span>}
          </div>
          <button style={{ ...badgeBase, cursor: "pointer", padding: "5px 10px", border: `1px solid ${t.border}`, background: "transparent", color: t.text2, gap: 4 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            복사
          </button>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onBack} style={{ flex: 1, height: 42, borderRadius: 10, border: `1px solid ${t.border}`, background: "transparent", color: t.text2, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          다시 제출
        </button>
        <button style={{ flex: 1, height: 42, borderRadius: 10, border: "none", background: t.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          다른 문제 풀기
        </button>
      </div>
    </div>
  );
}

export default function AlgoSuSubmissions() {
  const [mode, setMode] = useState("dark");
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [diffFilter, setDiffFilter] = useState("전체");
  const [weekFilter, setWeekFilter] = useState("전체");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [selectedSub, setSelectedSub] = useState(null);
  const t = THEMES[mode];

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  const filtered = submissions.filter(s => {
    if (search && !s.problem.includes(search)) return false;
    if (diffFilter !== "전체" && s.diff !== diffFilter) return false;
    if (weekFilter !== "전체" && s.week !== weekFilter) return false;
    if (statusFilter !== "전체" && s.status !== statusFilter) return false;
    return true;
  });

  const totalCount = submissions.length;
  const avgScore = Math.round(submissions.filter(s => s.aiScore !== null).reduce((a, b) => a + b.aiScore, 0) / submissions.filter(s => s.aiScore !== null).length);

  const selectStyle = {
    height: 34, padding: "0 28px 0 10px", borderRadius: 8,
    border: `1px solid ${t.border}`, background: t.inputBg, color: t.text,
    fontSize: 12, fontFamily: "inherit", cursor: "pointer", outline: "none",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(t.text3)}' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
  };

  return (
    <div style={{ fontFamily: "'Sora','Noto Sans KR',-apple-system,sans-serif", background: t.bg, color: t.text, minHeight: "100vh", transition: "background .4s, color .4s" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0}::selection{background:${t.primarySoft2}}@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}input:focus,select:focus{border-color:${t.primary} !important;outline:none}`}</style>

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: t.navBg, backdropFilter: "blur(20px) saturate(180%)", borderBottom: `1px solid ${t.border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
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
              <button style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t.text3 }}>
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
        {selectedSub ? (
          <AIResultView submission={selectedSub} t={t} onBack={() => setSelectedSub(null)} />
        ) : (
        <div>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -.5 }}>내 제출</h1>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ padding: "8px 14px", borderRadius: 10, background: t.bgCard, border: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 6, boxShadow: t.shadow }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              <span style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: t.primary }}>{totalCount}</span>
              <span style={{ fontSize: 11, color: t.text3 }}>총 제출</span>
            </div>
            <div style={{ padding: "8px 14px", borderRadius: 10, background: t.bgCard, border: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 6, boxShadow: t.shadow }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83"/></svg>
              <span style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: t.success }}>{avgScore}</span>
              <span style={{ fontSize: 11, color: t.text3 }}>평균 점수</span>
            </div>
          </div>
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
            <option>전체</option><option>3월1주</option><option>2월4주</option><option>2월3주</option><option>2월2주</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
            <option>전체</option><option>분석 완료</option><option>분석 중</option>
          </select>
          <button onClick={() => { setSearch(""); setDiffFilter("전체"); setWeekFilter("전체"); setStatusFilter("전체"); }} style={{ height: 34, padding: "0 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: "transparent", color: t.text3, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>초기화</button>
        </div>

        {/* Table */}
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, overflow: "hidden", boxShadow: t.shadow }}>
          {/* Header row */}
          <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 80px 72px 120px 80px 64px", borderBottom: `1px solid ${t.border}` }}>
            {["주차", "문제", "난이도", "언어", "제출 시간", "상태", "AI"].map(h => (
              <div key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 600, color: t.text3, textTransform: "uppercase", letterSpacing: .5 }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={t.text3} strokeWidth="1.5" strokeLinecap="round" style={{ margin: "0 auto 8px", opacity: .3 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <div style={{ fontSize: 13, color: t.text3 }}>검색 결과가 없습니다</div>
            </div>
          ) : filtered.map((s, i) => (
            <div key={s.id} onClick={() => s.status === "분석 완료" && setSelectedSub(s)} style={{
              display: "grid", gridTemplateColumns: "64px 1fr 80px 72px 120px 80px 64px",
              borderBottom: i < filtered.length - 1 ? `1px solid ${t.border}` : "none",
              cursor: s.status === "분석 완료" ? "pointer" : "default",
              opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(8px)",
              transition: `all .4s cubic-bezier(.16,1,.3,1) ${.1 + i * .03}s`,
            }}
              onMouseEnter={e => e.currentTarget.style.background = t.primarySoft}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ padding: "12px 14px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: t.text3, display: "flex", alignItems: "center" }}>{s.week}</div>
              <div style={{ padding: "12px 14px", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center" }}>{s.problem}</div>
              <div style={{ padding: "12px 14px", display: "flex", alignItems: "center" }}><DiffBadge diff={s.diff} /></div>
              <div style={{ padding: "12px 14px", display: "flex", alignItems: "center" }}><LangBadge lang={s.lang} t={t} /></div>
              <div style={{ padding: "12px 14px", fontSize: 11, color: t.text3, display: "flex", alignItems: "center", fontFamily: "'JetBrains Mono',monospace" }}>{s.time}</div>
              <div style={{ padding: "12px 14px", display: "flex", alignItems: "center" }}><StatusBadge status={s.status} t={t} /></div>
              <div style={{ padding: "12px 14px", display: "flex", alignItems: "center" }}><ScoreBadge score={s.aiScore} t={t} /></div>
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
        )}
      </main>
    </div>
  );
}
