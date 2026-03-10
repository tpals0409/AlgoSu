/**
 * @file Jest 설정 — Next.js 15 + React 19 호환
 * @domain common
 * @layer config
 */
import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  forceExit: true,
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!lucide-react)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      statements: 86,
      branches: 80,
      functions: 88,
      lines: 86,
    },
  },
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    'src/components/**/*.{ts,tsx}',
    'src/hooks/**/*.ts',
    '!src/**/*.d.ts',
    '!src/components/ui/accordion.tsx',
    '!src/components/ui/alert-dialog.tsx',
    '!src/components/ui/aspect-ratio.tsx',
    '!src/components/ui/avatar.tsx',
    '!src/components/ui/breadcrumb.tsx',
    '!src/components/ui/calendar.tsx',
    '!src/components/ui/carousel.tsx',
    '!src/components/ui/chart.tsx',
    '!src/components/ui/checkbox.tsx',
    '!src/components/ui/collapsible.tsx',
    '!src/components/ui/command.tsx',
    '!src/components/ui/context-menu.tsx',
    '!src/components/ui/dialog.tsx',
    '!src/components/ui/drawer.tsx',
    '!src/components/ui/dropdown-menu.tsx',
    '!src/components/ui/form.tsx',
    '!src/components/ui/hover-card.tsx',
    '!src/components/ui/input-otp.tsx',
    '!src/components/ui/label.tsx',
    '!src/components/ui/menubar.tsx',
    '!src/components/ui/navigation-menu.tsx',
    '!src/components/ui/pagination.tsx',
    '!src/components/ui/popover.tsx',
    '!src/components/ui/progress.tsx',
    '!src/components/ui/radio-group.tsx',
    '!src/components/ui/resizable.tsx',
    '!src/components/ui/scroll-area.tsx',
    '!src/components/ui/select.tsx',
    '!src/components/ui/separator.tsx',
    '!src/components/ui/sheet.tsx',
    '!src/components/ui/sidebar.tsx',
    '!src/components/ui/slider.tsx',
    '!src/components/ui/sonner.tsx',
    '!src/components/ui/switch.tsx',
    '!src/components/ui/table.tsx',
    '!src/components/ui/tabs.tsx',
    '!src/components/ui/textarea.tsx',
    '!src/components/ui/toggle.tsx',
    '!src/components/ui/toggle-group.tsx',
    '!src/components/ui/tooltip.tsx',
    '!src/components/ui/use-mobile.ts',
    '!src/components/ui/AlgosuUI.tsx',
    '!src/components/ui/AddProblemModal.tsx',
    '!src/components/ui/MarkdownViewer.tsx',
    '!src/components/ui/NotificationBell.tsx',
    '!src/components/ui/ImageWithFallback.tsx',
    '!src/hooks/useSessionKeepAlive.ts',
  ],
};

export default config;
