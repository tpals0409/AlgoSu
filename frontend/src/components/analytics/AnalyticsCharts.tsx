/**
 * @file 통계 차트 영역 — Figma v3 디자인
 * @domain analytics
 * @layer component
 * @related AnalyticsPage, Card, recharts
 */

'use client';

import { useState, useEffect, type ReactNode, type CSSProperties } from 'react';
import {
  FileText,
  CheckCircle2,
  Sparkles,
  Flame,
  TrendingUp,
  BarChart3,
  Tag,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { Card } from '@/components/ui/Card';

// ─── TYPES ───────────────────────────────

interface WeeklySubmission {
  week: string;
  count: number;
}

interface AIScoreEntry {
  date: string;
  score: number;
  problem: string;
}

interface DifficultyRow {
  tier: string;
  count: number;
  color: string;
}

interface TagRow {
  tag: string;
  count: number;
}

export interface AnalyticsChartsProps {
  readonly totalSubmissions: number;
  readonly solvedProblems: number;
  readonly completionPct: number;
  readonly avgAIScore: number;
  readonly streak: number;
  readonly streakRank: string;
  readonly weeklyData: WeeklySubmission[];
  readonly aiScoreData: AIScoreEntry[];
  readonly difficultyData: DifficultyRow[];
  readonly tagData: TagRow[];
  readonly userName: string;
}

// ─── STAT CARD ───────────────────────────

function StatCard({
  icon: Icon,
  value,
  sub,
  label,
  iconColor,
  style,
}: {
  readonly icon: typeof FileText;
  readonly value: string | number;
  readonly sub?: string;
  readonly label: string;
  readonly iconColor?: string;
  readonly style?: CSSProperties;
}): ReactNode {
  return (
    <Card className="flex items-center justify-between px-3 py-3 sm:px-5 sm:py-4" style={style}>
      <div className="min-w-0">
        <p className="text-lg sm:text-2xl font-bold text-text truncate">{value}</p>
        {sub && <p className="text-[11px] text-text-3">{sub}</p>}
        {!sub && <p className="text-[11px] text-text-3">{label}</p>}
      </div>
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: 'var(--bg-alt)' }}
      >
        <Icon className="h-5 w-5" style={{ color: iconColor ?? 'var(--primary)' }} />
      </div>
    </Card>
  );
}

// ─── COMPONENT ───────────────────────────

export default function AnalyticsCharts({
  totalSubmissions,
  solvedProblems,
  completionPct,
  avgAIScore,
  streak,
  streakRank,
  weeklyData,
  aiScoreData,
  difficultyData,
  tagData,
}: AnalyticsChartsProps): ReactNode {
  const [mounted, setMounted] = useState(false);
  const [barsAnimated, setBarsAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(() => setBarsAnimated(true), 300);
    return () => clearTimeout(t);
  }, [mounted]);

  const fade = (delay = 0): CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}s, transform .5s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  const diffMax = Math.max(...difficultyData.map((d) => d.count), 1);
  const tagMax = Math.max(...tagData.map((d) => d.count), 1);
  return (
    <div className="space-y-4">
      {/* ── StatCards 4열 ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" style={fade(0)}>
        <StatCard
          icon={FileText}
          value={totalSubmissions}
          label="누적 제출 횟수"
          sub="누적 제출 횟수"
        />
        <StatCard
          icon={CheckCircle2}
          value={`${solvedProblems}문제`}
          label="해결 문제"
          sub={`완료율 ${completionPct}%`}
        />
        <StatCard
          icon={Sparkles}
          value={`${avgAIScore}점`}
          label="평균 AI 점수"
          sub="AI 코드 분석 평균"
        />
        <StatCard
          icon={Flame}
          value={`${streak}주`}
          label="연속 제출"
          sub={streakRank}
        />
      </div>

      {/* ── 주차별 제출 추이 (Bar Chart) ── */}
      <Card className="p-5" style={fade(0.06)}>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4" style={{ color: 'var(--primary)' }} />
          <span className="text-[14px] font-semibold text-text">주차별 제출 추이</span>
        </div>
        {weeklyData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-text-3 text-sm">
            아직 제출 기록이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto" style={{ backgroundColor: 'var(--bg-card)' }}>
            <div className="h-[200px]" style={{ minWidth: Math.max(weeklyData.length * 56, 300) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weeklyData}
                  barSize={weeklyData.length > 12 ? 16 : 28}
                  style={{ outline: 'none' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                    axisLine={false}
                    tickLine={false}
                    interval={weeklyData.length > 12 ? Math.floor(weeklyData.length / 10) : 0}
                    angle={weeklyData.length > 8 ? -45 : 0}
                    textAnchor={weeklyData.length > 8 ? 'end' : 'middle'}
                    height={weeklyData.length > 8 ? 50 : 30}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} name="제출" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Card>

      {/* ── AI 점수 추이 (Line Chart + 리스트) ── */}
      <Card className="p-5" style={fade(0.1)}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: 'var(--primary)' }} />
            <span className="text-[14px] font-semibold text-text">AI 점수 추이</span>
          </div>
          <span
            className="rounded-full px-3 py-1 text-[12px] font-bold"
            style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}
          >
            평균 {avgAIScore}점
          </span>
        </div>
        {aiScoreData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-text-3 text-sm">
            분석 완료된 제출이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto" style={{ backgroundColor: 'var(--bg-card)' }}>
            <div className="h-[180px]" style={{ minWidth: Math.max(aiScoreData.length * 56, 300) }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={aiScoreData} style={{ outline: 'none' }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                    axisLine={false}
                    tickLine={false}
                    interval={aiScoreData.length > 12 ? Math.floor(aiScoreData.length / 10) : 0}
                    angle={aiScoreData.length > 8 ? -45 : 0}
                    textAnchor={aiScoreData.length > 8 ? 'end' : 'middle'}
                    height={aiScoreData.length > 8 ? 50 : 30}
                  />
                  <YAxis
                    domain={[60, 100]}
                    tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    dot={{ fill: 'var(--primary)', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: 'var(--primary)' }}
                    name="AI 점수"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Card>

      {/* ── 난이도별 해결 수 + 알고리즘 태그 분포 (2열) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" style={fade(0.14)}>
        {/* 난이도별 해결 수 */}
        <Card className="flex flex-col p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4" style={{ color: 'var(--primary)' }} />
            <span className="text-[14px] font-semibold text-text">난이도별 해결 수</span>
          </div>
          {difficultyData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-text-3 text-sm">
              아직 문제를 해결하지 않았습니다.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {difficultyData.map((row) => (
                  <div key={row.tier} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-20 shrink-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: row.color }}
                      />
                      <span className="text-[13px] text-text">{row.tier}</span>
                    </div>
                    <div className="flex-1 h-5 rounded-sm overflow-hidden" style={{ backgroundColor: 'var(--bg-alt)' }}>
                      <div
                        className="h-full rounded-sm transition-all duration-700 ease-out"
                        style={{
                          width: barsAnimated ? `${(row.count / diffMax) * 100}%` : '0%',
                          backgroundColor: row.color,
                        }}
                      />
                    </div>
                    <span className="w-6 text-right text-[13px] font-semibold text-text shrink-0">{row.count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-4 flex justify-end">
                <span
                  className="flex items-center gap-1.5 text-[12px] font-medium"
                  style={{ color: 'var(--success)' }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  총 {difficultyData.reduce((s, r) => s + r.count, 0)}문제 해결 완료
                </span>
              </div>
            </>
          )}
        </Card>

        {/* 알고리즘 태그 분포 */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="h-4 w-4" style={{ color: 'var(--primary)' }} />
            <span className="text-[14px] font-semibold text-text">알고리즘 태그 분포</span>
          </div>
          {tagData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-text-3 text-sm">
              아직 문제를 해결하지 않았습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {tagData.map((row) => (
                  <div key={row.tag} className="flex items-center gap-3">
                    <span className="w-16 text-[13px] text-text shrink-0 truncate" title={row.tag}>{row.tag}</span>
                    <div className="flex-1 h-5 rounded-sm overflow-hidden" style={{ backgroundColor: 'var(--bg-alt)' }}>
                      <div
                        className="h-full rounded-sm transition-all duration-700 ease-out"
                        style={{
                          width: barsAnimated ? `${(row.count / tagMax) * 100}%` : '0%',
                          backgroundColor: 'var(--primary)',
                          opacity: 0.5 + (row.count / tagMax) * 0.5,
                        }}
                      />
                    </div>
                    <span className="w-6 text-right text-[13px] font-semibold text-text shrink-0">{row.count}</span>
                  </div>
              ))}
            </div>
          )}
        </Card>
      </div>

    </div>
  );
}
