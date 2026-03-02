import { useState, useEffect, useCallback } from "react";

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
    info: "#3B82CE", infoSoft: "rgba(59,130,206,0.10)",
    muted: "#9C9A95", mutedSoft: "rgba(156,154,149,0.12)",
    shadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
    shadowHover: "0 4px 24px rgba(0,0,0,0.10)",
    navBg: "rgba(250,250,248,0.88)",
    toastShadow: "0 8px 32px rgba(0,0,0,0.12)",
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
    info: "#5B9FE8", infoSoft: "rgba(91,159,232,0.12)",
    muted: "#6C6C68", mutedSoft: "rgba(108,108,104,0.15)",
    shadow: "0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)",
    shadowHover: "0 4px 24px rgba(0,0,0,0.3)",
    navBg: "rgba(15,15,18,0.88)",
    toastShadow: "0 8px 32px rgba(0,0,0,0.4)",
  },
};

const badgeBase = { display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 500, padding: "4px 9px", borderRadius: 6, lineHeight: 1, whiteSpace: "nowrap" };

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

const ICONS = {
  success: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  error: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  warning: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  info: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  ai: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83"/></svg>,
  submit: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  deadline: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  close: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

/* ─── Toast Component ─── */
function Toast({ toast, t, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 30); }, []);

  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(handleDismiss, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, handleDismiss]);

  const typeMap = {
    success: { color: t.success, soft: t.successSoft, icon: ICONS.success },
    error: { color: t.error, soft: t.errorSoft, icon: ICONS.error },
    warning: { color: t.warning, soft: t.warningSoft, icon: ICONS.warning },
    info: { color: t.info, soft: t.infoSoft, icon: ICONS.info },
    ai: { color: t.primary, soft: t.primarySoft, icon: ICONS.ai },
    submit: { color: t.success, soft: t.successSoft, icon: ICONS.submit },
    deadline: { color: t.error, soft: t.errorSoft, icon: ICONS.deadline },
  };
  const cfg = typeMap[toast.type] || typeMap.info;

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "14px 16px", borderRadius: 12,
      background: t.bgCard, border: `1px solid ${t.border}`,
      boxShadow: t.toastShadow, maxWidth: 380, width: "100%",
      borderLeft: `3px solid ${cfg.color}`,
      opacity: visible && !exiting ? 1 : 0,
      transform: visible && !exiting ? "translateX(0)" : "translateX(24px)",
      transition: "all .3s cubic-bezier(.16,1,.3,1)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Icon */}
      <div style={{
        width: 32, height: 32, borderRadius: 8, background: cfg.soft,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>{cfg.icon(cfg.color)}</div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, color: t.text }}>{toast.title}</div>
        {toast.message && <div style={{ fontSize: 12, color: t.text2, lineHeight: 1.5 }}>{toast.message}</div>}
        {toast.action && (
          <button style={{
            marginTop: 8, fontSize: 12, fontWeight: 600, color: cfg.color,
            background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
            padding: 0, display: "flex", alignItems: "center", gap: 3,
          }}>
            {toast.action}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        )}
      </div>

      {/* Close */}
      <button onClick={handleDismiss} style={{
        width: 24, height: 24, borderRadius: 6, border: "none",
        background: "transparent", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: t.text3, flexShrink: 0, transition: "color .15s",
      }}>{ICONS.close(t.text3)}</button>

      {/* Progress bar */}
      {toast.duration && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
          background: cfg.soft,
        }}>
          <div style={{
            height: "100%", background: cfg.color, opacity: .5,
            animation: `shrink ${toast.duration}ms linear forwards`,
          }} />
        </div>
      )}
    </div>
  );
}

/* ─── Notification Panel ─── */
function NotifPanel({ t, open }) {
  if (!open) return null;

  const notifs = [
    { type: "ai", title: "AI 분석 완료", msg: '"두 수의 합" — 92점', time: "방금 전", unread: true },
    { type: "submit", title: "제출 완료", msg: "이진 탐색 트리 코드가 제출되었습니다.", time: "5분 전", unread: true },
    { type: "deadline", title: "마감 임박", msg: '"다이나믹 프로그래밍" 마감까지 45분 남았습니다.', time: "15분 전", unread: true },
    { type: "info", title: "새 문제 등록", msg: '"최단 경로" 문제가 3월1주차에 추가되었습니다.', time: "1시간 전", unread: false },
    { type: "success", title: "GitHub 동기화", msg: "solution_two_sum.py가 커밋되었습니다.", time: "2시간 전", unread: false },
  ];

  const typeMap = {
    success: { color: t.success, soft: t.successSoft, icon: ICONS.success },
    error: { color: t.error, soft: t.errorSoft, icon: ICONS.error },
    warning: { color: t.warning, soft: t.warningSoft, icon: ICONS.warning },
    info: { color: t.info, soft: t.infoSoft, icon: ICONS.info },
    ai: { color: t.primary, soft: t.primarySoft, icon: ICONS.ai },
    submit: { color: t.success, soft: t.successSoft, icon: ICONS.submit },
    deadline: { color: t.error, soft: t.errorSoft, icon: ICONS.deadline },
  };

  return (
    <div style={{
      position: "absolute", right: 0, top: "calc(100% + 8px)",
      width: 360, background: t.bgCard, border: `1px solid ${t.border}`,
      borderRadius: 14, boxShadow: t.shadowHover, overflow: "hidden", zIndex: 200,
    }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>알림</span>
        <span style={{ ...badgeBase, fontSize: 10, background: t.primarySoft, color: t.primary }}>{notifs.filter(n => n.unread).length}개 미읽음</span>
      </div>

      <div style={{ maxHeight: 380, overflow: "auto" }}>
        {notifs.map((n, i) => {
          const cfg = typeMap[n.type] || typeMap.info;
          return (
            <div key={i} style={{
              padding: "12px 18px", display: "flex", gap: 10,
              background: n.unread ? cfg.soft : "transparent",
              cursor: "pointer", transition: "background .15s",
              borderBottom: `1px solid ${t.border}`,
              borderLeft: n.unread ? `3px solid ${cfg.color}` : "3px solid transparent",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: n.unread ? t.bgCard : t.bgAlt,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                border: n.unread ? `1px solid ${t.border}` : "none",
              }}>{cfg.icon(cfg.color)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: n.unread ? 600 : 500, color: t.text }}>{n.title}</div>
                <div style={{ fontSize: 11, color: t.text2, marginTop: 2, lineHeight: 1.4 }}>{n.msg}</div>
                <div style={{ fontSize: 10, color: t.text3, marginTop: 4 }}>{n.time}</div>
              </div>
              {n.unread && <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, flexShrink: 0, marginTop: 4 }} />}
            </div>
          );
        })}
      </div>

      <div style={{ padding: "10px 18px", borderTop: `1px solid ${t.border}`, textAlign: "center" }}>
        <span style={{ fontSize: 12, color: t.primary, fontWeight: 500, cursor: "pointer" }}>모든 알림 읽음 처리</span>
      </div>
    </div>
  );
}

/* ─── MAIN DEMO ─── */
export default function AlgoSuNotifications() {
  const [mode, setMode] = useState("dark");
  const [toasts, setToasts] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [nextId, setNextId] = useState(0);
  const t = THEMES[mode];

  const addToast = (toast) => {
    const id = nextId;
    setNextId(n => n + 1);
    setToasts(prev => [...prev, { ...toast, id }]);
  };

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const demoToasts = [
    { type: "success", title: "제출 완료", message: '"두 수의 합" 코드가 성공적으로 제출되었습니다.', duration: 5000 },
    { type: "ai", title: "AI 분석 완료", message: '"이진 탐색 트리" 분석이 완료되었습니다. 88점', action: "결과 보기", duration: 7000 },
    { type: "deadline", title: "마감 임박", message: '"다이나믹 프로그래밍" 마감까지 45분 남았습니다.', action: "문제 풀기", duration: 8000 },
    { type: "error", title: "제출 실패", message: "네트워크 오류가 발생했습니다. 다시 시도해 주세요.", action: "재시도", duration: 6000 },
    { type: "warning", title: "저장되지 않은 변경", message: "코드 변경 사항이 아직 저장되지 않았습니다.", duration: 5000 },
    { type: "info", title: "새 문제 등록", message: '"최단 경로" 문제가 3월1주차에 추가되었습니다.', duration: 5000 },
    { type: "success", title: "GitHub 동기화", message: "solution.py가 성공적으로 커밋되었습니다.", duration: 4000 },
  ];

  return (
    <div style={{ fontFamily: "'Sora','Noto Sans KR',-apple-system,sans-serif", background: t.bg, color: t.text, minHeight: "100vh", transition: "background .4s, color .4s" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0}::selection{background:${t.primarySoft2}}@keyframes shrink{from{width:100%}to{width:0%}}`}</style>

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: t.navBg, backdropFilter: "blur(20px) saturate(180%)", borderBottom: `1px solid ${t.border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Logo size={28} primary={t.primary} accent={t.accent} />
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -.5 }}>AlgoSu</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setMode(m => m === "light" ? "dark" : "light")} style={{ height: 28, padding: "0 8px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", fontSize: 11, fontWeight: 400, display: "flex", alignItems: "center", gap: 4, color: t.text3, fontFamily: "inherit" }}>
              {mode === "light" ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>}
              {mode === "light" ? "라이트" : "다크"}
            </button>
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowNotif(!showNotif)} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t.text3 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              </button>
              <div style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: "50%", background: t.error, border: `1.5px solid ${t.bgCard}` }} />
              <NotifPanel t={t} open={showNotif} />
            </div>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg,${t.primary},${t.accent})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>김</div>
          </div>
        </div>
      </nav>

      {/* CONTENT */}
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 60px" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ ...badgeBase, background: t.primarySoft, color: t.primary, fontWeight: 600, letterSpacing: .8, textTransform: "uppercase", fontSize: 10, margin: "0 auto 12px", display: "inline-flex" }}>컴포넌트 프리뷰</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -.5, marginBottom: 6 }}>알림 & 토스트</h1>
          <p style={{ fontSize: 13, color: t.text3 }}>버튼을 클릭해서 각 유형의 토스트를 확인하세요</p>
        </div>

        {/* Toast Trigger Buttons */}
        <div style={{
          background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14,
          padding: 24, boxShadow: t.shadow, marginBottom: 24,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: t.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", color: t.primary }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600 }}>토스트 알림</span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {demoToasts.map((dt, i) => {
              const colors = {
                success: { bg: t.successSoft, color: t.success, border: t.success },
                ai: { bg: t.primarySoft, color: t.primary, border: t.primary },
                deadline: { bg: t.errorSoft, color: t.error, border: t.error },
                error: { bg: t.errorSoft, color: t.error, border: t.error },
                warning: { bg: t.warningSoft, color: t.warning, border: t.warning },
                info: { bg: t.infoSoft, color: t.info, border: t.info },
              };
              const c = colors[dt.type] || colors.info;
              return (
                <button key={i} onClick={() => addToast(dt)} style={{
                  ...badgeBase, cursor: "pointer", padding: "8px 14px", gap: 5,
                  border: `1px solid ${c.border}30`, background: c.bg, color: c.color,
                  fontWeight: 600, transition: "all .15s", fontSize: 12,
                }}>
                  {ICONS[dt.type]?.(c.color) || ICONS.info(c.color)}
                  {dt.title}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notification Panel Preview */}
        <div style={{
          background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14,
          padding: 24, boxShadow: t.shadow,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: t.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", color: t.primary }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600 }}>알림 패널</span>
          </div>
          <p style={{ fontSize: 12, color: t.text2, lineHeight: 1.6 }}>
            네비게이션 바의 벨 아이콘을 클릭하면 알림 패널이 열립니다.
            미읽음 알림은 유형별 컬러 배경과 왼쪽 보더로 강조되며,
            읽은 알림은 투명 배경으로 구분됩니다.
          </p>
        </div>
      </main>

      {/* Toast Container */}
      <div style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 1000,
        display: "flex", flexDirection: "column-reverse", gap: 8,
      }}>
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} t={t} onDismiss={removeToast} />
        ))}
      </div>

      {showNotif && <div onClick={() => setShowNotif(false)} style={{ position: "fixed", inset: 0, zIndex: 50 }} />}
    </div>
  );
}
