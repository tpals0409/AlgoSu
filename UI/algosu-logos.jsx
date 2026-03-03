import { useState } from "react";

const THEMES = {
  light: {
    bg: "#FAFAF8", bgCard: "#FFFFFF", border: "#E8E5E0",
    text: "#1A1917", text2: "#5C5A55", text3: "#9C9A95",
    primary: "#7C6AAE", accent: "#C4A6FF",
    primarySoft: "rgba(124,106,174,0.08)",
    shadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
  },
  dark: {
    bg: "#0F0F12", bgCard: "#1C1C22", border: "#2A2A32",
    text: "#EDEDEB", text2: "#A5A5A0", text3: "#6C6C68",
    primary: "#A08CD6", accent: "#C4A6FF",
    primarySoft: "rgba(160,140,214,0.10)",
    shadow: "0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)",
  },
};

function LogoOption({ label, desc, children, selected, onClick, t }) {
  return (
    <div onClick={onClick} style={{
      background: t.bgCard, border: `2px solid ${selected ? t.primary : t.border}`,
      borderRadius: 16, padding: 28, cursor: "pointer",
      boxShadow: selected ? `0 0 0 3px ${t.primarySoft}` : t.shadow,
      transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
    }}>
      {/* Logo preview at multiple sizes */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {children(48)}
        </div>
        <div style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {children(32)}
        </div>
        <div style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {children(20)}
        </div>
      </div>

      {/* In nav context */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 16px", borderRadius: 10,
        background: t.primarySoft, width: "100%", justifyContent: "center",
      }}>
        <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {children(28)}
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.5, color: t.text }}>AlgoSu</span>
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3, color: t.text }}>{label}</div>
        <div style={{ fontSize: 11, color: t.text3, lineHeight: 1.5 }}>{desc}</div>
      </div>

      {selected && (
        <span style={{
          fontSize: 10, fontWeight: 600, color: t.primary,
          padding: "3px 10px", borderRadius: 5, background: t.primarySoft,
        }}>선택됨</span>
      )}
    </div>
  );
}

export default function AlgoSuLogos() {
  const [mode, setMode] = useState("dark");
  const [selected, setSelected] = useState(null);
  const t = THEMES[mode];

  return (
    <div style={{
      fontFamily: "'Sora', 'Noto Sans KR', -apple-system, sans-serif",
      background: t.bg, color: t.text, minHeight: "100vh",
      padding: "40px 24px", transition: "background 0.4s, color 0.4s",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* Header */}
      <div style={{ maxWidth: 880, margin: "0 auto 32px", textAlign: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 11, fontWeight: 600, color: t.primary,
          padding: "5px 12px", borderRadius: 20,
          background: t.primarySoft, letterSpacing: 0.8,
          textTransform: "uppercase", marginBottom: 12,
        }}>로고 시안</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.8, marginBottom: 6 }}>
          AlgoSu 아이콘 디자인
        </h1>
        <p style={{ fontSize: 13, color: t.text3, marginBottom: 16 }}>
          마음에 드는 시안을 클릭해 주세요
        </p>
        <button onClick={() => setMode(m => m === "light" ? "dark" : "light")} style={{
          height: 28, padding: "0 12px", borderRadius: 6,
          border: "none", background: t.primarySoft,
          cursor: "pointer", fontSize: 11, fontWeight: 500,
          color: t.text3, fontFamily: "inherit",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          {mode === "light" ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
          )}
          {mode === "light" ? "라이트" : "다크"}
        </button>
      </div>

      {/* Logo Grid */}
      <div style={{
        maxWidth: 880, margin: "0 auto",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
      }}>
        {/* A — 코드 브래킷 */}
        <LogoOption
          label="A. 코드 브래킷"
          desc="< > 안에 A를 넣어 알고리즘/코드 느낌"
          selected={selected === "A"} onClick={() => setSelected("A")} t={t}
        >
          {(size) => {
            const r = size * 0.18;
            return (
              <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx={r < 4 ? 6 : 8} fill={`url(#gA${size})`} />
                <defs>
                  <linearGradient id={`gA${size}`} x1="0" y1="0" x2="40" y2="40">
                    <stop stopColor={t.primary} />
                    <stop offset="1" stopColor={t.accent} />
                  </linearGradient>
                </defs>
                <text x="20" y="21.5" textAnchor="middle" dominantBaseline="central"
                  fill="white" fontFamily="'JetBrains Mono', monospace" fontSize="13" fontWeight="600"
                  opacity="0.5">&lt;</text>
                <text x="20" y="21.5" textAnchor="middle" dominantBaseline="central"
                  fill="white" fontFamily="Sora, sans-serif" fontSize="16" fontWeight="700">A</text>
                <text x="31" y="21.5" textAnchor="middle" dominantBaseline="central"
                  fill="white" fontFamily="'JetBrains Mono', monospace" fontSize="13" fontWeight="600"
                  opacity="0.5">&gt;</text>
              </svg>
            );
          }}
        </LogoOption>

        {/* B — 노드 연결 */}
        <LogoOption
          label="B. 노드 그래프"
          desc="알고리즘의 핵심인 그래프/노드를 추상화"
          selected={selected === "B"} onClick={() => setSelected("B")} t={t}
        >
          {(size) => {
            const r = size * 0.18;
            return (
              <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx={r < 4 ? 6 : 8} fill={`url(#gB${size})`} />
                <defs>
                  <linearGradient id={`gB${size}`} x1="0" y1="0" x2="40" y2="40">
                    <stop stopColor={t.primary} />
                    <stop offset="1" stopColor={t.accent} />
                  </linearGradient>
                </defs>
                {/* Edges */}
                <line x1="14" y1="14" x2="26" y2="14" stroke="white" strokeWidth="1.5" opacity="0.4" />
                <line x1="14" y1="14" x2="14" y2="26" stroke="white" strokeWidth="1.5" opacity="0.4" />
                <line x1="14" y1="26" x2="26" y2="26" stroke="white" strokeWidth="1.5" opacity="0.4" />
                <line x1="26" y1="14" x2="26" y2="26" stroke="white" strokeWidth="1.5" opacity="0.4" />
                <line x1="14" y1="14" x2="26" y2="26" stroke="white" strokeWidth="1.5" opacity="0.3" />
                {/* Nodes */}
                <circle cx="14" cy="14" r="3.5" fill="white" />
                <circle cx="26" cy="14" r="3" fill="white" opacity="0.7" />
                <circle cx="14" cy="26" r="3" fill="white" opacity="0.7" />
                <circle cx="26" cy="26" r="3.5" fill="white" />
              </svg>
            );
          }}
        </LogoOption>

        {/* C — 미니멀 A + 경로 */}
        <LogoOption
          label="C. 경로 탐색"
          desc="A 글자에 경로 선을 결합한 미니멀 심볼"
          selected={selected === "C"} onClick={() => setSelected("C")} t={t}
        >
          {(size) => {
            const r = size * 0.18;
            return (
              <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx={r < 4 ? 6 : 8} fill={`url(#gC${size})`} />
                <defs>
                  <linearGradient id={`gC${size}`} x1="0" y1="0" x2="40" y2="40">
                    <stop stopColor={t.primary} />
                    <stop offset="1" stopColor={t.accent} />
                  </linearGradient>
                </defs>
                {/* Stylized A as path */}
                <path d="M13 28L20 11L27 28" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <line x1="15.5" y1="22" x2="24.5" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                {/* Small dot accent at peak */}
                <circle cx="20" cy="11" r="2" fill="white" opacity="0.9" />
              </svg>
            );
          }}
        </LogoOption>

        {/* D — 스택/레이어 */}
        <LogoOption
          label="D. 레이어 스택"
          desc="코드 레이어가 쌓이는 성장 느낌의 추상 심볼"
          selected={selected === "D"} onClick={() => setSelected("D")} t={t}
        >
          {(size) => {
            const r = size * 0.18;
            return (
              <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx={r < 4 ? 6 : 8} fill={`url(#gD${size})`} />
                <defs>
                  <linearGradient id={`gD${size}`} x1="0" y1="0" x2="40" y2="40">
                    <stop stopColor={t.primary} />
                    <stop offset="1" stopColor={t.accent} />
                  </linearGradient>
                </defs>
                {/* Stacked layers */}
                <path d="M20 10L30 16L20 22L10 16Z" fill="white" opacity="0.35" />
                <path d="M10 20L20 26L30 20" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.55" />
                <path d="M10 24L20 30L30 24" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9" />
              </svg>
            );
          }}
        </LogoOption>
      </div>

      {/* Selection summary */}
      {selected && (
        <div style={{
          maxWidth: 880, margin: "24px auto 0", textAlign: "center",
          padding: "16px", borderRadius: 12,
          background: t.primarySoft, border: `1px solid ${t.border}`,
        }}>
          <span style={{ fontSize: 13, color: t.text2 }}>
            <strong style={{ color: t.primary }}>시안 {selected}</strong>을 선택하셨습니다. 이 방향으로 진행할까요?
          </span>
        </div>
      )}
    </div>
  );
}
