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
    muted: "#6C6C68", mutedSoft: "rgba(108,108,104,0.15)",
    shadow: "0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)",
    navBg: "rgba(15,15,18,0.88)",
    barFill: "linear-gradient(90deg, #A08CD6, #B9A6E8)", barTrack: "#222228",
  },
};

const badgeBase = { display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 500, padding: "4px 9px", borderRadius: 6, lineHeight: 1, whiteSpace: "nowrap" };

const members = [
  { name: "김민수", role: "스터디장", solved: 42, rate: 95, avatar: "김" },
  { name: "이서연", role: "멤버", solved: 38, rate: 87, avatar: "이" },
  { name: "박지훈", role: "멤버", solved: 35, rate: 80, avatar: "박" },
  { name: "최유나", role: "멤버", solved: 29, rate: 66, avatar: "최" },
  { name: "정도현", role: "멤버", solved: 25, rate: 57, avatar: "정" },
  { name: "한소희", role: "멤버", solved: 22, rate: 50, avatar: "한" },
  { name: "오준혁", role: "멤버", solved: 18, rate: 41, avatar: "오" },
  { name: "윤채원", role: "멤버", solved: 12, rate: 27, avatar: "윤" },
];

const weeklyStats = [
  { week: "3월1주", total: 56, avg: 7.0 },
  { week: "2월4주", total: 48, avg: 6.0 },
  { week: "2월3주", total: 52, avg: 6.5 },
  { week: "2월2주", total: 40, avg: 5.0 },
  { week: "2월1주", total: 36, avg: 4.5 },
  { week: "1월4주", total: 32, avg: 4.0 },
];

const diffStats = [
  { diff: "브론즈", count: 12, color: "#C06800" },
  { diff: "실버", count: 8, color: "#5A7B99" },
  { diff: "골드", count: 5, color: "#D48A00" },
  { diff: "플래티넘", count: 3, color: "#20C490" },
  { diff: "다이아", count: 1, color: "#00A8E8" },
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

function useAnimVal(target, dur = 800) {
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
    const step = (ts) => { if (!s) s = ts; const p = Math.min((ts - s) / dur, 1); setVal(Math.round((1 - Math.pow(1 - p, 3)) * target)); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, [go, target, dur]);
  return [ref, val];
}

/* ─── STUDY MANAGEMENT TAB ─── */
function StudyTab({ t, mounted }) {
  const card = { background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow };
  const fade = (d = 0) => ({ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)", transition: `all .5s cubic-bezier(.16,1,.3,1) ${d}s` });

  return (
    <div>
      {/* Study Info Card */}
      <div style={{ ...card, padding: 24, marginBottom: 14, ...fade(.05) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: t.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", color: t.primary }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600 }}>스터디 정보</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            { label: "스터디명", value: "알고리즘 마스터" },
            { label: "생성일", value: "2025-12-01" },
            { label: "현재 주차", value: "3월1주차" },
            { label: "마감 요일", value: "일요일 23:59" },
          ].map((item, i) => (
            <div key={i}>
              <div style={{ fontSize: 11, color: t.text3, marginBottom: 3 }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 11, color: t.text3, marginBottom: 6 }}>초대 코드</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{
              flex: 1, height: 38, padding: "0 12px", borderRadius: 8,
              background: t.bgAlt, border: `1px solid ${t.border}`,
              display: "flex", alignItems: "center",
              fontSize: 14, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace",
              color: t.primary, letterSpacing: 2,
            }}>ALGO-MS-2026</div>
            <button style={{
              height: 38, padding: "0 14px", borderRadius: 8,
              border: `1px solid ${t.border}`, background: "transparent",
              color: t.text2, fontSize: 12, fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              복사
            </button>
          </div>
        </div>
      </div>

      {/* Members Card */}
      <div style={{ ...card, padding: 0, overflow: "hidden", ...fade(.12) }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: t.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", color: t.primary }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600 }}>멤버</span>
            <span style={{ ...badgeBase, background: t.primarySoft, color: t.primary }}>{members.length}명</span>
          </div>
          <button style={{ height: 34, padding: "0 14px", borderRadius: 8, background: t.primary, color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            초대
          </button>
        </div>

        {members.map((m, i) => (
          <div key={i} style={{
            padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: i < members.length - 1 ? `1px solid ${t.border}` : "none",
            transition: "background .15s", cursor: "default",
          }}
            onMouseEnter={e => e.currentTarget.style.background = t.primarySoft}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: i === 0 ? `linear-gradient(135deg,${t.primary},${t.accent})` : t.bgAlt,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 600, color: i === 0 ? "#fff" : t.text2,
              }}>{m.avatar}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                  {m.name}
                  {m.role === "스터디장" && <span style={{ ...badgeBase, fontSize: 9, padding: "2px 6px", background: t.primarySoft, color: t.primary }}>스터디장</span>}
                </div>
                <div style={{ fontSize: 11, color: t.text3, marginTop: 1 }}>{m.solved}문제 풀이 · 완료율 {m.rate}%</div>
              </div>
            </div>
            <div style={{ width: 60, height: 4, background: t.barTrack, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${m.rate}%`, background: m.rate >= 80 ? t.success : m.rate >= 50 ? t.warning : t.error, borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── STATISTICS TAB ─── */
function StatsTab({ t, mounted }) {
  const card = { background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow };
  const fade = (d = 0) => ({ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)", transition: `all .5s cubic-bezier(.16,1,.3,1) ${d}s` });
  const [r1, v1] = useAnimVal(29);
  const [r2, v2] = useAnimVal(81);
  const [r3, v3] = useAnimVal(86);
  const maxTotal = Math.max(...weeklyStats.map(w => w.total));

  return (
    <div>
      {/* Overview Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 14, ...fade(.05) }}>
        {[
          { ref: r1, val: v1, label: "총 풀이 수", suf: "", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>, color: t.primary },
          { ref: r2, val: v2, label: "평균 AI 점수", suf: "점", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83"/></svg>, color: t.success },
          { ref: r3, val: v3, label: "제출 완료율", suf: "%", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>, color: t.success },
        ].map((s, i) => (
          <div key={i} ref={s.ref} style={{ ...card, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: t.text3, marginBottom: 6 }}>{s.icon}{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: s.color, letterSpacing: -1 }}>{s.val}{s.suf}</div>
          </div>
        ))}
      </div>

      {/* Weekly Chart */}
      <div style={{ ...card, padding: 24, marginBottom: 14, ...fade(.12) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: t.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", color: t.primary }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600 }}>주차별 제출 추이</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140, paddingBottom: 24, position: "relative" }}>
          {weeklyStats.map((w, i) => {
            const pct = (w.total / maxTotal) * 100;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", color: t.text }}>{w.total}</span>
                <div style={{
                  width: "100%", maxWidth: 40, height: mounted ? `${pct}%` : "0%",
                  background: t.barFill, borderRadius: "6px 6px 4px 4px",
                  transition: `height .8s cubic-bezier(.16,1,.3,1) ${.2 + i * .08}s`,
                  minHeight: 4,
                }} />
                <span style={{ fontSize: 10, color: t.text3, fontFamily: "'JetBrains Mono',monospace" }}>{w.week}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Difficulty Distribution */}
      <div style={{ ...card, padding: 24, ...fade(.2) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: t.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", color: t.primary }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600 }}>난이도별 분포</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {diffStats.map((d, i) => {
            const total = diffStats.reduce((a, b) => a + b.count, 0);
            const pct = (d.count / total) * 100;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 500, minWidth: 52, color: d.color }}>{d.diff}</span>
                <div style={{ flex: 1, height: 8, background: t.barTrack, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: mounted ? `${pct}%` : "0%",
                    background: d.color, borderRadius: 4,
                    transition: `width .8s cubic-bezier(.16,1,.3,1) ${.3 + i * .08}s`,
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", minWidth: 24, textAlign: "right" }}>{d.count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── PROFILE TAB ─── */
function ProfileTab({ t, mounted }) {
  const card = { background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow };
  const fade = (d = 0) => ({ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)", transition: `all .5s cubic-bezier(.16,1,.3,1) ${d}s` });
  const [r1, v1] = useAnimVal(42);
  const [r2, v2] = useAnimVal(87);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      {/* Profile Header */}
      <div style={{ ...card, padding: 28, textAlign: "center", marginBottom: 14, ...fade(.05) }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20, margin: "0 auto 14px",
          background: `linear-gradient(135deg,${t.primary},${t.accent})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26, fontWeight: 700, color: "#fff",
          boxShadow: `0 4px 20px rgba(124,106,174,.3)`,
        }}>김</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>김민수</h2>
        <p style={{ fontSize: 13, color: t.text3, marginBottom: 14 }}>minsu.kim@email.com</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          <span style={{ ...badgeBase, background: t.primarySoft, color: t.primary, fontWeight: 600 }}>알고리즘 마스터 · 스터디장</span>
          <span style={{ ...badgeBase, background: t.successSoft, color: t.success }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 3 }}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            GitHub 연동
          </span>
        </div>
      </div>

      {/* Personal Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14, ...fade(.12) }}>
        <div ref={r1} style={{ ...card, padding: "18px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: t.text3, marginBottom: 6 }}>총 풀이</div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: t.primary }}>{v1}</div>
        </div>
        <div ref={r2} style={{ ...card, padding: "18px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: t.text3, marginBottom: 6 }}>완료율</div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: t.success }}>{v2}%</div>
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 14, ...fade(.2) }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: t.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", color: t.primary }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600 }}>최근 활동</span>
        </div>
        {[
          { action: "코드 제출", target: "두 수의 합", time: "방금 전", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> },
          { action: "AI 분석 완료", target: "이진 탐색 트리 — 88점", time: "2시간 전", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.primary} strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83"/></svg> },
          { action: "코드 제출", target: "최단 경로", time: "5시간 전", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> },
          { action: "스터디 참여", target: "알고리즘 마스터", time: "2일 전", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.warning} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
        ].map((a, i) => (
          <div key={i} style={{
            padding: "12px 24px", display: "flex", alignItems: "center", gap: 10,
            borderBottom: i < 3 ? `1px solid ${t.border}` : "none",
          }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: t.bgAlt, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{a.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{a.action} <span style={{ color: t.text2 }}>— {a.target}</span></div>
              <div style={{ fontSize: 10, color: t.text3, marginTop: 2 }}>{a.time}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Settings */}
      <div style={{ ...card, padding: 24, ...fade(.28) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: t.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", color: t.primary }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600 }}>설정</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { label: "GitHub 레포지토리", value: "github.com/minsu/algo-master" },
            { label: "알림 설정", value: "마감 24시간 전, AI 분석 완료" },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${t.border}` }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: t.text3, marginTop: 1 }}>{s.value}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.text3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN ─── */
export default function AlgoSuStudyProfile() {
  const [mode, setMode] = useState("dark");
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState("study");
  const [showNotif, setShowNotif] = useState(false);
  const t = THEMES[mode];

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  const tabs = [
    { key: "study", label: "스터디 관리", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
    { key: "stats", label: "통계", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg> },
    { key: "profile", label: "프로필", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  ];

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
        {/* Tab bar */}
        <div style={{
          display: "flex", gap: 4, marginBottom: 24,
          background: t.bgCard, border: `1px solid ${t.border}`,
          borderRadius: 12, padding: 4, boxShadow: t.shadow,
        }}>
          {tabs.map(tb => (
            <button key={tb.key} onClick={() => setTab(tb.key)} style={{
              flex: 1, height: 38, borderRadius: 9, border: "none",
              background: tab === tb.key ? t.primary : "transparent",
              color: tab === tb.key ? "#fff" : t.text3,
              fontSize: 13, fontWeight: tab === tb.key ? 600 : 400,
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              transition: "all .2s",
            }}>{tb.icon}{tb.label}</button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === "study" && <StudyTab t={t} mounted={mounted} />}
        {tab === "stats" && <StatsTab t={t} mounted={mounted} />}
        {tab === "profile" && <ProfileTab t={t} mounted={mounted} />}
      </main>

      {showNotif && <div onClick={() => setShowNotif(false)} style={{ position: "fixed", inset: 0, zIndex: 50 }} />}
    </div>
  );
}
