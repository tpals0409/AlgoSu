import { useState, useEffect } from "react";

const THEMES = {
  light: {
    bg: "#FAFAF8", bgCard: "#FFFFFF", border: "#E8E5E0",
    text: "#1A1917", text2: "#5C5A55", text3: "#9C9A95",
    primary: "#7C6AAE", accent: "#C4A6FF",
    primarySoft: "rgba(124,106,174,0.08)",
    shadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)",
    navBg: "rgba(250,250,248,0.85)", inputBg: "#F3F1EE",
    heroGlow: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(124,106,174,0.10) 0%, transparent 70%)",
    google: { bg: "#FFFFFF", color: "#333", border: "#E0DDD8", hover: "#F5F3F0" },
    naver: { bg: "#03C75A", color: "#fff", border: "#03C75A", hover: "#02b351" },
    kakao: { bg: "#FEE500", color: "#191919", border: "#FEE500", hover: "#F0D800" },
  },
  dark: {
    bg: "#0F0F12", bgCard: "#1C1C22", border: "#2A2A32",
    text: "#EDEDEB", text2: "#A5A5A0", text3: "#6C6C68",
    primary: "#A08CD6", accent: "#C4A6FF",
    primarySoft: "rgba(160,140,214,0.10)",
    shadow: "0 1px 3px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.2)",
    navBg: "rgba(15,15,18,0.85)", inputBg: "#1C1C22",
    heroGlow: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(160,140,214,0.12) 0%, transparent 70%)",
    google: { bg: "#1C1C22", color: "#EDEDEB", border: "#2A2A32", hover: "#252530" },
    naver: { bg: "#03C75A", color: "#fff", border: "#03C75A", hover: "#02b351" },
    kakao: { bg: "#FEE500", color: "#191919", border: "#FEE500", hover: "#F0D800" },
  },
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

function GoogleIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>;
}
function NaverIcon() {
  return <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M13.56 10.7L6.17 1H1v18h5.44V9.3L13.83 19H19V1h-5.44v9.7z" fill="currentColor"/></svg>;
}
function KakaoIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M12 3C6.48 3 2 6.36 2 10.44c0 2.62 1.75 4.93 4.38 6.24l-1.12 4.1c-.1.36.31.65.63.44l4.85-3.2c.42.04.84.06 1.26.06 5.52 0 10-3.36 10-7.5S17.52 3 12 3z" fill="#191919"/></svg>;
}

export default function AlgoSuLogin() {
  const [mode, setMode] = useState("dark");
  const [mounted, setMounted] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState(null);
  const t = THEMES[mode];

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  const fade = (d = 0) => ({ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(20px)", transition: `opacity .6s cubic-bezier(.16,1,.3,1) ${d}s, transform .6s cubic-bezier(.16,1,.3,1) ${d}s` });

  const oBtn = (provider, idx) => {
    const c = t[provider]; const h = hoveredBtn === provider;
    return { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", height: 48, borderRadius: 12, background: h ? c.hover : c.bg, color: c.color, border: `1px solid ${c.border}`, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "'Sora','Noto Sans KR',sans-serif", transition: "all .2s", transform: h ? "translateY(-1px)" : "translateY(0)", boxShadow: h ? "0 4px 12px rgba(0,0,0,.08)" : "none", ...fade(.25 + idx * .08) };
  };

  return (
    <div style={{ fontFamily: "'Sora','Noto Sans KR',-apple-system,sans-serif", background: t.bg, color: t.text, minHeight: "100vh", transition: "background .4s, color .4s", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0}::selection{background:${t.primarySoft}}`}</style>

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: t.navBg, backdropFilter: "blur(20px) saturate(180%)", borderBottom: `1px solid ${t.border}` }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <Logo size={28} primary={t.primary} accent={t.accent} />
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -.5 }}>AlgoSu</span>
          </div>
          <button onClick={() => setMode(m => m === "light" ? "dark" : "light")} style={{ height: 28, padding: "0 8px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", fontSize: 11, fontWeight: 400, display: "flex", alignItems: "center", gap: 4, color: t.text3, fontFamily: "inherit" }}>
            {mode === "light" ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>}
            {mode === "light" ? "라이트" : "다크"}
          </button>
        </div>
      </nav>

      {/* MAIN */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "56px 24px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: t.heroGlow, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 500, height: 500, opacity: mode === "dark" ? .03 : .025, backgroundImage: `radial-gradient(${t.primary} 1px,transparent 1px)`, backgroundSize: "20px 20px", pointerEvents: "none", borderRadius: "50%" }} />

        <div style={{ position: "relative", width: "100%", maxWidth: 400, ...fade(0) }}>
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 20, padding: "40px 32px 32px", boxShadow: t.shadow }}>
            <div style={{ textAlign: "center", marginBottom: 32, ...fade(.1) }}>
              <div style={{ margin: "0 auto 16px", display: "flex", justifyContent: "center" }}>
                <Logo size={48} primary={t.primary} accent={t.accent} />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -.5, marginBottom: 6 }}>AlgoSu에 로그인</h1>
              <p style={{ fontSize: 13, color: t.text3 }}>알고리즘 스터디 플랫폼</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button style={oBtn("google", 0)} onMouseEnter={() => setHoveredBtn("google")} onMouseLeave={() => setHoveredBtn(null)}><GoogleIcon /> Google로 계속하기</button>
              <button style={oBtn("naver", 1)} onMouseEnter={() => setHoveredBtn("naver")} onMouseLeave={() => setHoveredBtn(null)}><NaverIcon /> Naver로 계속하기</button>
              <button style={oBtn("kakao", 2)} onMouseEnter={() => setHoveredBtn("kakao")} onMouseLeave={() => setHoveredBtn(null)}><KakaoIcon /> Kakao로 계속하기</button>
            </div>

            <p style={{ fontSize: 11, color: t.text3, textAlign: "center", lineHeight: 1.6, marginTop: 28, ...fade(.45) }}>
              로그인 시 <span style={{ color: t.primary, cursor: "pointer" }}>서비스 약관</span> 및 <span style={{ color: t.primary, cursor: "pointer" }}>개인정보 처리방침</span>에 동의합니다.
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 28, ...fade(.5) }}>
            {[
              { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>, label: "GitHub 연동" },
              { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83"/></svg>, label: "AI 코드 리뷰" },
              { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>, label: "성장 통계" },
            ].map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: t.text3 }}>{f.icon}{f.label}</div>
            ))}
          </div>
        </div>
      </main>

      <footer style={{ padding: "20px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 11, color: t.text3 }}>© 2026 AlgoSu. All rights reserved.</p>
      </footer>
    </div>
  );
}
