/**
 * @file       icons.ts
 * @domain     blog
 * @layer      ui
 * @related    architecture-map.tsx, echelon-matrix.tsx, hierarchy-tree.tsx, phase-timeline.tsx, pipeline.tsx
 *
 * MDX에서 string-based icon name으로 lucide-react 아이콘을 참조할 수 있게 하는 registry.
 * MDX 파일에 `icon={Crown}` 같은 식별자 import 없이 `icon="Crown"`으로 사용 가능.
 */
import type { ComponentType } from 'react';
import {
  Globe,
  Shield,
  Server,
  Database,
  Workflow,
  Sparkles,
  Cloud,
  Cpu,
  Network,
  Send,
  Boxes,
  Crown,
  Compass,
  PenLine,
  ScrollText,
  GraduationCap,
  Megaphone,
  Palette,
  Telescope,
  Search,
  Hammer,
  TestTube2,
  Rocket,
  Bell,
  Lock,
  GitBranch,
  Package,
  Layers,
  Users,
  Wrench,
  ChevronDown,
} from 'lucide-react';

// lucide-react 1.8.0이 LucideIcon 타입을 export하지 않으므로 자체 정의.
export type LucideIcon = ComponentType<{
  className?: string;
  size?: number;
  strokeWidth?: number;
}>;

export const ICONS = {
  Globe,
  Shield,
  Server,
  Database,
  Workflow,
  Sparkles,
  Cloud,
  Cpu,
  Network,
  Send,
  Boxes,
  Crown,
  Compass,
  PenLine,
  ScrollText,
  GraduationCap,
  Megaphone,
  Palette,
  Telescope,
  Search,
  Hammer,
  TestTube2,
  Rocket,
  Bell,
  Lock,
  GitBranch,
  Package,
  Layers,
  Users,
  Wrench,
  ChevronDown,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/**
 * string 키로 lucide 아이콘 컴포넌트를 lookup. 미존재 키는 fallback으로 Boxes.
 */
export function getIcon(name: IconName | string | undefined): LucideIcon | undefined {
  if (!name) return undefined;
  return (ICONS as Record<string, LucideIcon>)[name];
}
