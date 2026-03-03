import { useState, useEffect, useRef } from "react";

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

const badgeBase = { display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 500, padding: "4px 9px", borderRadius: 6, lineHeight: 1, whiteSpace: "nowrap" };

const DIFFS = {
  "브론즈": { bg: "rgba(173,86,0,.12)", color: "#C06800", border: "rgba(173,86,0,.25)" },
  "골드": { bg: "rgba(236,144,3,.12)", color: "#D48A00", border: "rgba(236,144,3,.25)" },
};

const feedbackData = [
  { category: "시간 복잡도", score: 95, grade: "우수", color: "success", comment: "해시맵을 활용한 O(n) 풀이로 최적의 시간 복잡도를 달성했습니다.", lines: [2, 3, 4, 5, 6, 7] },
  { category: "공간 복잡도", score: 88, grade: "우수", color: "success", comment: "O(n) 추가 공간을 사용하지만, 시간-공간 트레이드오프를 적절히 활용했습니다.", lines: [2] },
  { category: "코드 가독성", score: 92, grade: "우수", color: "success", comment: "변수명이 직관적이고 로직이 간결합니다. 독스트링이 추가되면 더 좋겠습니다.", lines: [0, 1, 2, 3] },
  { category: "에러 처리", score: 70, grade: "보통", color: "warning", comment: "ValueError 예외를 사용했으나, 입력 유효성 검증이 추가되면 더 견고해집니다.", lines: [8] },
  { category: "엣지 케이스", score: 60, grade: "개선 필요", color: "warning", comment: "빈 배열, 중복 요소, 음수 입력 등의 엣지 케이스 처리가 부족합니다.", lines: [0, 8] },
];

const originalCode = `def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    raise ValueError("No solution")`;

const optimizedCode = `from typing import List, Optional, Tuple

def two_sum(
    nums: List[int], target: int
) -> Optional[Tuple[int, int]]:
    """두 수의 합이 target이 되는 인덱스를 반환
    
    Args:
        nums: 정수 배열
        target: 목표 합
    Returns:
        두 인덱스의 튜플, 없으면 None
    """
    if not nums or len(nums) < 2:
        return None
    
    seen: dict[int, int] = {}
    for i, num in enumerate(nums):
        if (comp := target - num) in seen:
            return (seen[comp], i)
        seen[num] = i
    return None`;

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

function ScoreGauge({ score, size = 140, t }) {
  const [ref, animScore] = useAnimVal(score, 1200);
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * animScore) / 100;
  const color = score >= 80 ? t.success : score >= 50 ? t.warning : t.error;
  const label = score >= 80 ? "우수" : score >= 50 ? "보통" : "개선 필요";

  return (
    <div ref={ref} style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.border} strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset .1s linear" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color, letterSpacing: -2 }}>
          {Math.round(animScore)}
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, color: t.text3, marginTop: -2 }}>{label}</div>
      </div>
    </div>
  );
}

function CategoryBar({ item, t, delay, selected, onClick }) {
  const [ref, animW] = useAnimVal(item.score, 800);
  const color = item.color === "success" ? t.success : item.color === "warning" ? t.warning : t.error;
  const softColor = item.color === "success" ? t.successSoft : item.color === "warning" ? t.warningSoft : t.errorSoft;

  return (
    <div ref={ref} onClick={onClick} style={{
      padding: "16px 0", borderBottom: `1px solid ${t.border}`,
      cursor: "pointer", transition: "all .15s",
      marginLeft: -24, marginRight: -24, paddingLeft: 24, paddingRight: 24,
      background: selected ? t.primarySoft : "transparent",
      borderLeft: selected ? `3px solid ${t.primary}` : "3px solid transparent",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: selected ? 600 : 500, color: selected ? t.text : t.text }}>{item.category}</span>
          <span style={{ ...badgeBase, background: softColor, color }}>{item.grade}</span>
          {selected && (
            <span style={{ fontSize: 10, color: t.primary, display: "flex", alignItems: "center", gap: 3 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              코드 하이라이트 중
            </span>
          )}
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", color }}>{Math.round(animW)}</span>
      </div>
      <div style={{ height: 6, background: t.border, borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${animW}%`, background: color,
          borderRadius: 3, transition: "width .1s linear",
        }} />
      </div>
      <p style={{ fontSize: 12, color: t.text2, lineHeight: 1.6, marginTop: 8 }}>{item.comment}</p>
    </div>
  );
}

export default function AlgoSuAIResult() {
  const [mode, setMode] = useState("dark");
  const [mounted, setMounted] = useState(false);
  const [codeTab, setCodeTab] = useState("original");
  const [selectedCat, setSelectedCat] = useState(null);
  const [showNotif, setShowNotif] = useState(false);
  const codeRef = useRef(null);
  const t = THEMES[mode];

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  const fade = (d = 0) => ({ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(16px)", transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${d}s, transform .5s cubic-bezier(.16,1,.3,1) ${d}s` });
  const card = { background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow };
  const totalScore = Math.round(feedbackData.reduce((a, b) => a + b.score, 0) / feedbackData.length);

  return (
    <div style={{ fontFamily: "'Sora','Noto Sans KR',-apple-system,sans-serif", background: t.bg, color: t.text, minHeight: "100vh", transition: "background .4s, color .4s" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0}::selection{background:${t.primarySoft2}}`}</style>

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
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px 60px" }}>
        {/* Back */}
        <button style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 12, color: t.text3, background: "none", border: "none",
          cursor: "pointer", fontFamily: "inherit", marginBottom: 8, padding: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          제출 목록
        </button>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28, ...fade(0) }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -.5, marginBottom: 6 }}>AI 코드 분석 결과</h1>
          <p style={{ fontSize: 13, color: t.text3 }}>두 수의 합 · Python · 방금 전 제출</p>
        </div>

        {/* ── Score Overview Card ── */}
        <div style={{ ...card, padding: 28, marginBottom: 14, ...fade(.08) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
            {/* Gauge */}
            <ScoreGauge score={totalScore} size={140} t={t} />

            {/* Quick stats */}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                <span style={{ ...badgeBase, background: DIFFS["브론즈"].bg, color: DIFFS["브론즈"].color, border: `1px solid ${DIFFS["브론즈"].border}`, fontWeight: 600 }}>브론즈</span>
                <span style={{ ...badgeBase, background: t.primarySoft, color: t.primary }}>3월1주차</span>
                <span style={{ ...badgeBase, background: t.successSoft, color: t.success }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ marginRight: 3 }}><polyline points="20 6 9 17 4 12"/></svg>
                  제출 완료
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[
                  { label: "시간 복잡도", value: "O(n)", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
                  { label: "공간 복잡도", value: "O(n)", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg> },
                  { label: "코드 라인", value: "9줄", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> },
                ].map((s, i) => (
                  <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: t.bgAlt, textAlign: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 11, color: t.text3, marginBottom: 4 }}>{s.icon}{s.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Category Feedback Card ── */}
        <div style={{ ...card, padding: "8px 24px", marginBottom: 14, ...fade(.16) }}>
          {feedbackData.map((item, i) => (
            <CategoryBar key={i} item={item} t={t} delay={.2 + i * .05}
              selected={selectedCat === i}
              onClick={() => {
                setSelectedCat(selectedCat === i ? null : i);
                setCodeTab("original");
                setTimeout(() => codeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
              }}
            />
          ))}
        </div>

        {/* ── AI Summary Card ── */}
        <div style={{ ...card, padding: 24, marginBottom: 14, ...fade(.24) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: t.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", color: t.primary }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83"/></svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600 }}>AI 총평</span>
          </div>
          <p style={{ fontSize: 13, color: t.text2, lineHeight: 1.75 }}>
            해시맵을 활용한 효율적인 O(n) 풀이입니다. 시간 복잡도와 코드 가독성 모두 우수하며,
            변수명도 직관적입니다. 다만 입력 유효성 검증과 엣지 케이스 처리를 보강하면
            더 견고한 코드가 될 수 있습니다. 타입 힌트와 독스트링을 추가하는 것도 권장합니다.
          </p>
        </div>

        {/* ── Code Comparison Card ── */}
        <div ref={codeRef} style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 14, ...fade(.32) }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${t.border}` }}>
            {[
              { key: "original", label: "내 코드", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> },
              { key: "optimized", label: "최적화 코드", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83"/></svg> },
            ].map(tab => (
              <button key={tab.key} onClick={() => { setCodeTab(tab.key); if (tab.key === "optimized") setSelectedCat(null); }} style={{
                flex: 1, padding: "12px 16px", border: "none",
                background: codeTab === tab.key ? t.primarySoft : "transparent",
                color: codeTab === tab.key ? t.primary : t.text3,
                fontSize: 13, fontWeight: codeTab === tab.key ? 600 : 400,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                borderBottom: codeTab === tab.key ? `2px solid ${t.primary}` : "2px solid transparent",
                transition: "all .2s",
              }}>{tab.icon}{tab.label}</button>
            ))}
          </div>

          {/* Code with line highlights */}
          <div style={{ position: "relative" }}>
            {codeTab === "optimized" && (
              <div style={{
                position: "absolute", top: 12, right: 12, zIndex: 2,
                ...badgeBase, background: t.primarySoft, color: t.primary, fontSize: 10, fontWeight: 600, gap: 3,
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/></svg>
                AI 추천
              </div>
            )}

            {(() => {
              const codeStr = codeTab === "original" ? originalCode : optimizedCode;
              const lines = codeStr.split("\n");
              const highlightLines = selectedCat !== null && codeTab === "original" ? feedbackData[selectedCat].lines : [];
              const hlColor = selectedCat !== null ? (feedbackData[selectedCat].color === "success" ? t.success : t.warning) : t.primary;

              return (
                <div style={{ background: t.codeBg, overflow: "auto", minHeight: 200 }}>
                  {lines.map((line, i) => {
                    const isHL = highlightLines.includes(i);
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "stretch",
                        background: isHL ? (feedbackData[selectedCat]?.color === "success" ? t.successSoft : t.warningSoft) : "transparent",
                        borderLeft: isHL ? `3px solid ${hlColor}` : "3px solid transparent",
                        transition: "all .2s",
                      }}>
                        <span style={{
                          width: 40, minWidth: 40, textAlign: "right", paddingRight: 12,
                          fontSize: 12, fontFamily: "'JetBrains Mono',monospace",
                          color: isHL ? hlColor : t.text3, opacity: isHL ? .8 : .4,
                          lineHeight: "22px", paddingTop: i === 0 ? 16 : 0, paddingBottom: i === lines.length - 1 ? 16 : 0,
                          userSelect: "none", fontWeight: isHL ? 600 : 400,
                        }}>{i + 1}</span>
                        <pre style={{
                          margin: 0, padding: 0,
                          fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5,
                          lineHeight: "22px", color: isHL ? t.text : t.text2,
                          paddingTop: i === 0 ? 16 : 0, paddingBottom: i === lines.length - 1 ? 16 : 0,
                          fontWeight: isHL ? 500 : 400,
                        }}>{line || " "}</pre>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Footer */}
          <div style={{
            padding: "10px 16px", borderTop: `1px solid ${t.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: t.text3, fontFamily: "'JetBrains Mono',monospace" }}>
                {(codeTab === "original" ? originalCode : optimizedCode).split("\n").length}줄
              </span>
              {selectedCat !== null && codeTab === "original" && (
                <span style={{ ...badgeBase, fontSize: 10, background: t.primarySoft, color: t.primary, gap: 3 }}>
                  {feedbackData[selectedCat].category} · {feedbackData[selectedCat].lines.length}줄 하이라이트
                </span>
              )}
            </div>
            <button style={{
              ...badgeBase, cursor: "pointer", padding: "5px 12px",
              border: `1px solid ${t.border}`, background: "transparent",
              color: t.text2, gap: 4, transition: "all .15s",
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              복사
            </button>
          </div>
        </div>

        {/* ── Action Buttons ── */}
        <div style={{ display: "flex", gap: 10, ...fade(.4) }}>
          <button style={{
            flex: 1, height: 44, borderRadius: 10, border: `1px solid ${t.border}`,
            background: "transparent", color: t.text2, fontSize: 13, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            다시 제출
          </button>
          <button style={{
            flex: 1, height: 44, borderRadius: 10, border: "none",
            background: t.primary, color: "#fff", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            다른 문제 풀기
          </button>
        </div>
      </main>

      {showNotif && <div onClick={() => setShowNotif(false)} style={{ position: "fixed", inset: 0, zIndex: 50 }} />}
    </div>
  );
}
