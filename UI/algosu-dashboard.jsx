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
    shadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
    shadowHover: "0 2px 8px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.06)",
    navBg: "rgba(250,250,248,0.88)",
    barFill: "linear-gradient(90deg, #7C6AAE, #9B8BC8)", barTrack: "#EDEBE6",
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
    shadow: "0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)",
    shadowHover: "0 2px 8px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.2)",
    navBg: "rgba(15,15,18,0.88)",
    barFill: "linear-gradient(90deg, #A08CD6, #B9A6E8)", barTrack: "#222228",
  },
};

const weeklyData = [
  { label: "3월1주", value: 18, max: 20 },
  { label: "2월4주", value: 15, max: 20 },
  { label: "2월3주", value: 12, max: 20 },
  { label: "2월2주", value: 9, max: 20 },
  { label: "2월1주", value: 6, max: 20 },
];

const recentSubmissions = [
  { name: "두 수의 합", lang: "Python", time: "방금 전", status: "완료" },
  { name: "이진 탐색 트리", lang: "Java", time: "2시간 전", status: "분석 중" },
  { name: "최단 경로", lang: "C++", time: "5시간 전", status: "완료" },
];

const deadlines = [
  { name: "다이나믹 프로그래밍", week: "3월1주", diff: "골드", timer: "45:30", urgency: "critical" },
  { name: "그래프 탐색", week: "3월1주", diff: "실버", timer: "2:15:00", urgency: "warning" },
  { name: "문자열 처리", week: "3월1주", diff: "브론즈", timer: "5d 2h", urgency: "normal", done: true },
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
      <circle cx="14" cy="14" r="3.5" fill="#fff" />
      <circle cx="26" cy="14" r="3" fill="#fff" opacity=".7" />
      <circle cx="14" cy="26" r="3" fill="#fff" opacity=".7" />
      <circle cx="26" cy="26" r="3.5" fill="#fff" />
    </svg>
  );
}

function useAnimVal(target, dur = 800) {
  const [val, setVal] = useState(0);
  const [go, setGo] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setGo(true); }, { threshold: .3 });
    if (ref.current) o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    if (!go) return; let s = null;
    const step = (ts) => { if (!s) s = ts; const p = Math.min((ts - s) / dur, 1); setVal(Math.round((1 - Math.pow(1 - p, 3)) * target)); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, [go, target, dur]);
  return [ref, val];
}

export default function AlgoSuDashboard() {
  const [mode, setMode] = useState("dark");
  const [mounted, setMounted] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const t = THEMES[mode];

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  const fade = (d = 0) => ({ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(16px)", transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${d}s, transform .5s cubic-bezier(.16,1,.3,1) ${d}s` });

  const [r1, v1] = useAnimVal(42);
  const [r2, v2] = useAnimVal(8);
  const [r3, v3] = useAnimVal(87);

  const card = { background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow, transition: "all .3s" };

  const diffC = (d) => ({ "브론즈": { bg: "rgba(173,86,0,.12)", color: "#C06800" }, "실버": { bg: "rgba(67,95,122,.12)", color: "#5A7B99" }, "골드": { bg: "rgba(236,144,3,.12)", color: "#D48A00" }, "플래티넘": { bg: "rgba(39,226,164,.12)", color: "#20C490" }, "다이아": { bg: "rgba(0,180,252,.12)", color: "#00A8E8" } }[d] || { bg: "rgba(173,86,0,.12)", color: "#C06800" });

  const timerS = (u) => u === "critical" ? { bg: t.errorSoft, color: t.error, anim: true } : u === "warning" ? { bg: t.warningSoft, color: t.warning, anim: false } : { bg: t.primarySoft, color: t.text2, anim: false };

  return (
    <div style={{ fontFamily: "'Sora','Noto Sans KR',-apple-system,sans-serif", background: t.bg, color: t.text, minHeight: "100vh", transition: "background .4s, color .4s" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0}::selection{background:${t.primarySoft2}}@keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: t.navBg, backdropFilter: "blur(20px) saturate(180%)", borderBottom: `1px solid ${t.border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Logo size={28} primary={t.primary} accent={t.accent} />
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -.5 }}>AlgoSu</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Study selector */}
            <div style={{ padding: "5px 12px", borderRadius: 8, background: t.primarySoft, border: `1px solid ${t.border}`, fontSize: 12, fontWeight: 500, color: t.text2, cursor: "pointer", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>알고리즘 마스터</div>

            {/* Theme toggle */}
            <button onClick={() => setMode(m => m === "light" ? "dark" : "light")} style={{ height: 28, padding: "0 8px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", fontSize: 11, fontWeight: 400, display: "flex", alignItems: "center", gap: 4, color: t.text3, fontFamily: "inherit" }}>
              {mode === "light" ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>}
              {mode === "light" ? "라이트" : "다크"}
            </button>

            {/* Bell */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowNotif(!showNotif)} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t.text3 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              </button>
              <div style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: "50%", background: t.error, border: `1.5px solid ${t.bgCard}` }} />

              {showNotif && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 320, background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadowHover, overflow: "hidden", zIndex: 200 }}>
                  <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>알림</span>
                    <span style={{ fontSize: 11, color: t.primary, fontWeight: 500 }}>3개 미읽음</span>
                  </div>
                  {[
                    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83"/></svg>, title: "AI 분석 완료", msg: '"두 수의 합" — 92점', time: "방금 전" },
                    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>, title: "제출 완료", msg: "코드가 성공적으로 제출되었습니다.", time: "5분 전" },
                    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>, title: "새 문제 등록", msg: '"최단 경로" 문제가 추가되었습니다.', time: "1시간 전" },
                  ].map((n, i) => (
                    <div key={i} style={{ padding: "12px 16px", display: "flex", gap: 10, background: i < 2 ? t.primarySoft : "transparent", cursor: "pointer", borderBottom: `1px solid ${t.border}` }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: t.primarySoft2, display: "flex", alignItems: "center", justifyContent: "center", color: t.primary, flexShrink: 0 }}>{n.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{n.title}</div>
                        <div style={{ fontSize: 11, color: t.text2, marginTop: 1 }}>{n.msg}</div>
                        <div style={{ fontSize: 10, color: t.text3, marginTop: 3 }}>{n.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Avatar */}
            <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg,${t.primary},${t.accent})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>김</div>
          </div>
        </div>
      </nav>

      {/* CONTENT */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, ...fade(0) }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -.5 }}>대시보드</h1>
            <p style={{ fontSize: 12, color: t.text3, marginTop: 3 }}>알고리즘 마스터 스터디</p>
          </div>
          <button style={{ height: 34, padding: "0 14px", borderRadius: 9, background: "transparent", border: `1px solid ${t.border}`, color: t.text2, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            새로고침
          </button>
        </div>

        {/* STATS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20, ...fade(.08) }}>
          {[
            { ref: r1, val: v1, label: "내 제출", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>, color: t.primary, suf: "", sub: "이번 스터디 전체" },
            { ref: r2, val: v2, label: "참여 멤버", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>, color: t.text, suf: "", sub: "활성 멤버" },
            { ref: r3, val: v3, label: "내 완료율", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>, color: t.success, suf: "%", sub: "전체 문제 기준" },
          ].map((s, i) => (
            <div key={i} ref={s.ref} style={{ ...card, padding: "20px 20px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: t.text3, marginBottom: 8 }}>
                <span style={{ color: t.text3 }}>{s.icon}</span>{s.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: s.color, letterSpacing: -1 }}>{s.val}{s.suf}</div>
              <div style={{ fontSize: 11, color: t.text3, marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* WEEKLY */}
        <div style={{ ...card, padding: 20, marginBottom: 20, ...fade(.16) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>주차별 제출 현황</h2>
            <span style={{ fontSize: 11, fontWeight: 500, color: t.primary, padding: "3px 10px", borderRadius: 6, background: t.primarySoft }}>전체</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {weeklyData.map((w, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: t.text2, minWidth: 56, textAlign: "right" }}>{w.label}</span>
                <div style={{ flex: 1, height: 22, background: t.barTrack, borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: mounted ? `${(w.value / w.max) * 100}%` : "0%", background: t.barFill, borderRadius: 6, transition: `width .8s cubic-bezier(.16,1,.3,1) ${.3 + i * .1}s` }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", minWidth: 28 }}>{w.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* TWO COLS */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, ...fade(.24) }}>
          {/* Recent */}
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 14, fontWeight: 600 }}>최근 제출</h2>
              <span style={{ fontSize: 11, color: t.primary, cursor: "pointer", fontWeight: 500 }}>전체 보기 →</span>
            </div>
            {recentSubmissions.map((s, i) => (
              <div key={i} style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i < recentSubmissions.length - 1 ? `1px solid ${t.border}` : "none", cursor: "pointer", transition: "background .15s" }}
                onMouseEnter={e => e.currentTarget.style.background = t.primarySoft}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: t.text3, marginTop: 2 }}><span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{s.lang}</span><span style={{ margin: "0 6px", opacity: .3 }}>·</span>{s.time}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 6, background: s.status === "완료" ? t.successSoft : t.primarySoft, color: s.status === "완료" ? t.success : t.primary }}>{s.status}</span>
              </div>
            ))}
          </div>

          {/* Deadlines */}
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 14, fontWeight: 600 }}>마감 임박 문제</h2>
              <span style={{ fontSize: 11, color: t.primary, cursor: "pointer", fontWeight: 500 }}>전체 보기 →</span>
            </div>
            {deadlines.map((d, i) => {
              const ts = timerS(d.urgency); const dc = diffC(d.diff);
              return (
                <div key={i} style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i < deadlines.length - 1 ? `1px solid ${t.border}` : "none", cursor: "pointer", transition: "background .15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = t.primarySoft}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{d.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, color: t.text3 }}>{d.week}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: dc.bg, color: dc.color }}>{d.diff}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {d.done && <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 5, background: t.successSoft, color: t.success }}>제출 완료</span>}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, fontFamily: "'JetBrains Mono',monospace", padding: "3px 10px", borderRadius: 6, background: ts.bg, color: ts.color, animation: ts.anim ? "pulse-dot 1.5s infinite" : "none" }}>⏱ {d.timer}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {showNotif && <div onClick={() => setShowNotif(false)} style={{ position: "fixed", inset: 0, zIndex: 50 }} />}
    </div>
  );
}
