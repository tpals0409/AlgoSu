import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../ThemeProvider';

jest.mock('next-themes', () => ({
  ThemeProvider: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <div data-testid="next-themes-provider" data-props={JSON.stringify(props)}>
      {children}
    </div>
  ),
}));

describe('ThemeProvider', () => {
  it('children을 렌더링한다', () => {
    render(
      <ThemeProvider>
        <span>테스트 자식</span>
      </ThemeProvider>,
    );
    expect(screen.getByText('테스트 자식')).toBeInTheDocument();
  });

  it('NextThemesProvider에 props를 전달한다', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="dark">
        <span>내용</span>
      </ThemeProvider>,
    );
    const provider = screen.getByTestId('next-themes-provider');
    const props = JSON.parse(provider.getAttribute('data-props')!);
    expect(props.attribute).toBe('class');
    expect(props.defaultTheme).toBe('dark');
  });

  it('여러 children을 렌더링한다', () => {
    render(
      <ThemeProvider>
        <span>첫째</span>
        <span>둘째</span>
      </ThemeProvider>,
    );
    expect(screen.getByText('첫째')).toBeInTheDocument();
    expect(screen.getByText('둘째')).toBeInTheDocument();
  });
});
