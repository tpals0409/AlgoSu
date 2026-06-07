/**
 * @file 단일 선택 pill 그룹 — ARIA radiogroup + roving tabindex 헬퍼
 * @domain quiz
 * @layer component
 * @related QuizStart
 *
 * Sprint 224: QuizStart의 분야·난이도·문항 수 3개 단일 선택 그룹이 공유하는
 * 접근성 패턴(role=radiogroup/radio + aria-checked + roving tabindex + 화살표 키)을
 * 한 곳에 모은다. 시각 스타일은 소비처가 className/style 콜백으로 주입한다.
 */

'use client';

import { useId, useRef, type CSSProperties, type ReactElement, type ReactNode } from 'react';

interface PillRadioGroupProps<T extends string | number> {
  /** 그룹 라벨 (시각 표시 + radiogroup 접근 이름) */
  readonly legend: string;
  /** 선택지 목록 (표시 순서) */
  readonly options: readonly T[];
  /** 현재 선택값 */
  readonly value: T;
  /** 선택 변경 핸들러 */
  readonly onChange: (value: T) => void;
  /** 선택지의 React key (고유) */
  readonly getOptionKey: (option: T) => string;
  /** 선택지 className (활성 여부에 따라 분기) */
  readonly getOptionClassName: (option: T, active: boolean) => string;
  /** 선택지 내부 콘텐츠 (아이콘+라벨 등 — 접근 이름은 텍스트에서 파생) */
  readonly renderOption: (option: T, active: boolean) => ReactNode;
  /** 선택지 인라인 스타일 (accent 토큰 등, 선택) */
  readonly getOptionStyle?: (option: T, active: boolean) => CSSProperties | undefined;
}

/**
 * 단일 선택 pill 그룹을 radiogroup 시맨틱으로 렌더한다.
 * 선택된 항목만 tab 순서에 포함(roving tabindex)되고, 화살표/Home/End로
 * 그룹 내 선택과 포커스를 함께 이동한다 (WAI-ARIA radio group 패턴).
 *
 * @typeParam T 선택지 값 타입 (문자열 또는 숫자)
 */
export function PillRadioGroup<T extends string | number>({
  legend,
  options,
  value,
  onChange,
  getOptionKey,
  getOptionClassName,
  renderOption,
  getOptionStyle,
}: PillRadioGroupProps<T>): ReactElement {
  const labelId = useId();
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /**
   * 주어진 인덱스(순환)의 선택지를 선택하고 포커스를 옮긴다.
   * 화살표 키가 선택과 포커스를 동시에 이동시키는 radio group 규약을 따른다.
   *
   * @param index 이동 대상 인덱스 (음수/초과는 양 끝으로 순환)
   */
  const moveTo = (index: number): void => {
    const count = options.length;
    const next = ((index % count) + count) % count;
    onChange(options[next]);
    optionRefs.current[next]?.focus();
  };

  /**
   * 화살표/Home/End 키로 그룹 내 이동을 처리한다 (그 외 키는 기본 동작 유지).
   *
   * @param event 키보드 이벤트
   * @param currentIndex 이벤트가 발생한 선택지 인덱스
   */
  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ): void => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        moveTo(currentIndex + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        moveTo(currentIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        moveTo(0);
        break;
      case 'End':
        event.preventDefault();
        moveTo(options.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div className="space-y-2">
      <span id={labelId} className="block text-xs font-medium text-text-2">
        {legend}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {options.map((option, index) => {
          const active = option === value;
          return (
            <button
              key={getOptionKey(option)}
              ref={(el) => {
                optionRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(option)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              style={getOptionStyle?.(option, active)}
              className={getOptionClassName(option, active)}
            >
              {renderOption(option, active)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
