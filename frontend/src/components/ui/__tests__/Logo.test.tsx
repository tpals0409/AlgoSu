import { render, screen } from '@testing-library/react';
import { Logo } from '../Logo';

describe('Logo', () => {
  it('renders an SVG element', () => {
    render(<Logo />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('has role="img" attribute', () => {
    render(<Logo />);
    const svg = screen.getByRole('img');
    expect(svg.tagName.toLowerCase()).toBe('svg');
  });

  it('has aria-label="AlgoSu"', () => {
    render(<Logo />);
    expect(screen.getByRole('img', { name: 'AlgoSu' })).toBeInTheDocument();
  });

  it('applies custom size', () => {
    render(<Logo size={40} />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('width', '40');
    expect(svg).toHaveAttribute('height', '40');
  });

  it('applies custom className', () => {
    render(<Logo className="custom-class" />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveClass('custom-class');
  });
});
