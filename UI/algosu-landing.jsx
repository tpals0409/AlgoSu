import { useState, useEffect, useRef } from "react";

const THEMES = {
  light: {
    bg: "#FAFAF8", bgAlt: "#F3F1EE", bgCard: "#FFFFFF", surface: "#FFFFFF",
    border: "#E8E5E0", borderHover: "#D0CCC5",
    text: "#1A1917", text2: "#5C5A55", text3: "#9C9A95",
    primary: "#7C6AAE", primaryLight: "#9B8BC8",
    primarySoft: "rgba(124,106,174,0.08)", primarySoft2: "rgba(124,106,174,0.15)",
    accent: "#C4A6FF",
    success: "#3DAA6D", warning: "#E8A830", error: "#E05448",
    shadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
    shadowHover: "0 2px 8px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.06)",
    navBg: "rgba(250,250,248,0.85)",
    heroGlow: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(124,106,174,0.12) 0%, transparent 70%)",
    codeBg: "#F7F5F2",
  },
  dark: {
    bg: "#0F0F12", bgAlt: "#17171C", bgCard: "#1C1C22", surface: "#1C1C22",
    border: "#2A2A32", borderHover: "#3A3A44",
    text: "#EDEDEB", text2: "#A5A5A0", text3: "#6C6C68",
    primary: "#A08CD6", primaryLight: "#B9A6E8",
    primarySoft: "rgba(160,140,214,0.10)", primarySoft2: "rgba(160,140,214,0.18)",
    accent: "#C4A6FF",
    success: "#4EC87A", warning: "#F0B840", error: "#F06458",
    shadow: "0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)",
    shadowHover: "0 2px 8px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.2)",
    navBg: "rgba(15,15,18,0.85)",
    heroGlow: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(160,140,214,0.15) 0%, transparent 70%)",
    codeBg: "#14141A",
  },
};

const diffColors = {
  bronze: { bg: "rgba(173,86,0,0.12)", color: "#C06800", border: "rgba(173,86,0,0.25)" },
  silver: { bg: "rgba(67,95,122,0.12)", color: "#5A7B99", border: "rgba(67,95,122,0.25)" },
  gold: { bg: "rgba(236,144,3,0.12)", color: "#D48A00", border: "rgba(236,144,3,0.25)" },
  platinum: { bg: "rgba(39,226,164,0.12)", color: "#20C490", border: "rgba(39,226,164,0.25)" },
  diamond: { bg: "rgba(0,180,252,0.12)", color: "#00A8E8", border: "rgba(0,180,252,0.25)" },
};

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

function SunIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
}
function MoonIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>;
}

function useInView(th = 0.15) {
  const ref = useRef(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true); }, { threshold: th });
    o.observe(el); return () => o.disconnect();
  }, [th]);
  return [ref, v];
}

function DiffBadge({ level, label }) {
  const c = diffColors[level];
  return <span style={{ display: "inline-flex", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, background: c.bg, color: c.color, border: `1px solid ${c.border}`, letterSpacing: .3 }}>{label}</span>;
}

export default function AlgoSuLanding() {
  const [mode, setMode] = useState("dark");
  const t = THEMES[mode];
  const [heroRef, hV] = useInView(0.1);
  const [featRef, fV] = useInView(0.1);
  const [codeRef, cV] = useInView(0.1);
  const [ctaRef, ctV] = useInView(0.1);
  const fade = (v, d = 0) => ({ opacity: v ? 1 : 0, transform: v ? "translateY(0)" : "translateY(28px)", transition: `opacity .7s cubic-bezier(.16,1,.3,1) ${d}s, transform .7s cubic-bezier(.16,1,.3,1) ${d}s` });

  return (
    <div style={{ fontFamily: "'Sora','Noto Sans KR',-apple-system,sans-serif", background: t.bg, color: t.text, minHeight: "100vh", transition: "background .4s, color .4s", overflow: "hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}::selection{background:${t.primarySoft2}}`}</style>

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: t.navBg, backdropFilter: "blur(20px) saturate(180%)", borderBottom: `1px solid ${t.border}` }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Logo size={28} primary={t.primary} accent={t.accent} />
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -.5 }}>AlgoSu</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => setMode(m => m === "light" ? "dark" : "light")} style={{ height: 28, padding: "0 8px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", fontSize: 11, fontWeight: 400, display: "flex", alignItems: "center", gap: 4, color: t.text3, fontFamily: "inherit" }}>
              {mode === "light" ? <SunIcon /> : <MoonIcon />}{mode === "light" ? "라이트" : "다크"}
            </button>
            <button style={{ height: 36, padding: "0 18px", borderRadius: 10, background: t.primary, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>시작하기</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section ref={heroRef} style={{ position: "relative", paddingTop: 140, paddingBottom: 80, textAlign: "center" }}>
        <div style={{ position: "absolute", inset: 0, background: t.heroGlow, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 80, left: "50%", transform: "translateX(-50%)", width: 600, height: 400, opacity: mode === "dark" ? .04 : .03, backgroundImage: `radial-gradient(${t.primary} 1px,transparent 1px)`, backgroundSize: "24px 24px", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 720, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 28, flexWrap: "wrap", ...fade(hV, 0) }}>
            {[["bronze","브론즈"],["silver","실버"],["gold","골드"],["platinum","플래티넘"],["diamond","다이아"]].map(([l,n]) => <DiffBadge key={l} level={l} label={n} />)}
          </div>
          <h1 style={{ fontSize: "clamp(32px,5vw,52px)", fontWeight: 700, lineHeight: 1.2, letterSpacing: -1.5, marginBottom: 16, ...fade(hV, .1) }}>
            <span>알고리즘 스터디의</span><br />
            <span style={{ background: `linear-gradient(135deg,${t.primary},${t.accent})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>새로운 기준</span>
          </h1>
          <p style={{ fontSize: "clamp(14px,2vw,17px)", color: t.text2, lineHeight: 1.7, maxWidth: 460, margin: "0 auto 36px", ...fade(hV, .2) }}>문제 풀이부터 GitHub 동기화, AI 코드 분석까지.<br />팀과 함께 성장하세요.</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, ...fade(hV, .3) }}>
            <button style={{ height: 48, padding: "0 28px", borderRadius: 12, background: t.primary, color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 20px rgba(124,106,174,.35)" }}>무료로 시작하기 →</button>
            <button style={{ height: 48, padding: "0 24px", borderRadius: 12, background: "transparent", color: t.text, border: `1px solid ${t.border}`, fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>둘러보기</button>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 40, marginTop: 48, ...fade(hV, .4) }}>
            {[{ n: "2,400+", l: "풀이 제출" }, { n: "150+", l: "활성 스터디" }, { n: "98%", l: "만족도" }].map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: t.primary }}>{s.n}</div>
                <div style={{ fontSize: 12, color: t.text3, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section ref={featRef} style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: 48, ...fade(fV, 0) }}>
          <div style={{ display: "inline-flex", fontSize: 11, fontWeight: 600, color: t.primary, padding: "5px 12px", borderRadius: 20, background: t.primarySoft, letterSpacing: .8, textTransform: "uppercase", marginBottom: 16 }}>핵심 기능</div>
          <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -.8 }}>스터디에 필요한 모든 것</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
          {[
            { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>, title: "체계적인 문제 관리", desc: "난이도별 분류, 주차별 관리, 마감 타이머까지. 백준 문제 번호로 자동 연동됩니다." },
            { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>, title: "GitHub 자동 동기화", desc: "코드를 제출하면 스터디 레포에 자동 커밋. 잔디도 심고, 포트폴리오도 쌓으세요." },
            { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83"/></svg>, title: "AI 코드 리뷰", desc: "제출 코드를 AI가 분석해 점수, 피드백, 최적화 코드를 제공합니다." },
          ].map((f, i) => (
            <div key={i} style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 16, padding: 28, boxShadow: t.shadow, transition: "all .3s cubic-bezier(.16,1,.3,1)", cursor: "default", ...fade(fV, .1 + i * .1) }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = t.shadowHover; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = t.shadow; }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: t.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, color: t.primary }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: t.text2, lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CODE PREVIEW */}
      <section ref={codeRef} style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "center" }}>
          <div style={fade(cV, 0)}>
            <div style={{ display: "inline-flex", fontSize: 11, fontWeight: 600, color: t.success, padding: "5px 12px", borderRadius: 20, background: `rgba(${mode === "dark" ? "78,200,122" : "61,170,109"},.1)`, letterSpacing: .8, textTransform: "uppercase", marginBottom: 16 }}>AI 분석</div>
            <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -.8, marginBottom: 12 }}>코드를 제출하면<br />AI가 분석합니다</h2>
            <p style={{ fontSize: 14, color: t.text2, lineHeight: 1.7, marginBottom: 24 }}>시간 복잡도, 코드 품질, 개선 방향까지.<br />AI가 상세한 피드백과 최적화 코드를 제공합니다.</p>
            <div style={{ display: "flex", gap: 20 }}>
              {[{ s: 92, c: t.success, l: "우수" }, { s: 65, c: t.warning, l: "보통" }, { s: 30, c: t.error, l: "개선 필요" }].map((g, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: `conic-gradient(${g.c} ${g.s}%,${t.border} 0)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: g.c }}>{g.s}</div>
                  </div>
                  <div style={{ fontSize: 10, color: t.text3, marginTop: 6 }}>{g.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: t.codeBg, border: `1px solid ${t.border}`, borderRadius: 16, overflow: "hidden", boxShadow: t.shadow, ...fade(cV, .15) }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF5F56" }} /><div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFBD2E" }} /><div style={{ width: 10, height: 10, borderRadius: "50%", background: "#27C93F" }} /></div>
              <span style={{ fontSize: 11, color: t.text3 }}>solution.py</span>
            </div>
            <pre style={{ padding: 20, margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, lineHeight: 1.7, color: t.text2 }}>{`def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    raise ValueError("No solution")`}</pre>
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: t.primarySoft }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: t.primary, display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.primary} strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83"/></svg>
                AI 분석 완료 — 92점
              </span>
              <span style={{ fontSize: 11, color: t.primary, fontWeight: 600, cursor: "pointer" }}>피드백 보기 →</span>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ background: t.bgAlt, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: "72px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", fontSize: 11, fontWeight: 600, color: t.primary, padding: "5px 12px", borderRadius: 20, background: t.primarySoft, letterSpacing: .8, textTransform: "uppercase", marginBottom: 16 }}>사용 방법</div>
          <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -.8, marginBottom: 48 }}>3단계로 시작하세요</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
            {[{ s: "01", t: "스터디 생성", d: "스터디를 만들고 초대 코드로 팀원을 모으세요." }, { s: "02", t: "문제 풀이 & 제출", d: "배정된 문제를 풀고 코드를 제출하세요. GitHub에 자동 동기화." }, { s: "03", t: "AI 리뷰 & 성장", d: "AI 분석 피드백을 통해 실력을 키우세요." }].map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: t.primary, opacity: .3, marginBottom: 12 }}>{s.s}</div>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{s.t}</h3>
                <p style={{ fontSize: 13, color: t.text2, lineHeight: 1.6 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section ref={ctaRef} style={{ padding: "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", ...fade(ctV, 0) }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: -.8, marginBottom: 12 }}>지금 바로 시작하세요</h2>
          <p style={{ fontSize: 14, color: t.text2, lineHeight: 1.7, marginBottom: 32 }}>무료로 스터디를 만들고, 팀과 함께 알고리즘 실력을 키워보세요.</p>
          <button style={{ height: 52, padding: "0 36px", borderRadius: 14, background: `linear-gradient(135deg,${t.primary},${t.accent})`, color: "#fff", border: "none", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 24px rgba(124,106,174,.35)" }}>무료로 시작하기</button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: `1px solid ${t.border}`, padding: "32px 24px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
          <Logo size={20} primary={t.primary} accent={t.accent} />
          <span style={{ fontSize: 13, fontWeight: 600, color: t.text2 }}>AlgoSu</span>
        </div>
        <p style={{ fontSize: 11, color: t.text3 }}>© 2026 AlgoSu. All rights reserved.</p>
      </footer>
    </div>
  );
}
