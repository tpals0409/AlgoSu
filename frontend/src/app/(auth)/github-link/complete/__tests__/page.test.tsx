import { render, screen } from '@testing-library/react';
import GitHubLinkCompletePage from '../page';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
}));

describe('GitHubLinkCompletePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.location.hash = '';
  });

  it('처리 중 메시지가 표시된다', () => {
    render(<GitHubLinkCompletePage />);
    expect(screen.getByText('GitHub 연동 처리 중...')).toBeInTheDocument();
  });

  it('github_connected=true이면 localStorage에 저장하고 /studies로 리다이렉트한다', () => {
    window.location.hash = '#github_connected=true&github_username=testuser';

    render(<GitHubLinkCompletePage />);

    expect(localStorage.getItem('algosu:github-connected')).toBe('true');
    expect(localStorage.getItem('algosu:github-username')).toBe('testuser');
    expect(mockReplace).toHaveBeenCalledWith('/studies');
  });

  it('github_connected가 true가 아니면 /github-link로 리다이렉트한다', () => {
    window.location.hash = '#github_connected=false';

    render(<GitHubLinkCompletePage />);

    expect(mockReplace).toHaveBeenCalledWith('/github-link');
  });

  it('hash가 비어있으면 /github-link로 리다이렉트한다', () => {
    window.location.hash = '';

    render(<GitHubLinkCompletePage />);

    expect(mockReplace).toHaveBeenCalledWith('/github-link');
  });
});
