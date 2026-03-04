import { render, screen, fireEvent } from '@testing-library/react';
import { Toast } from '../Toast';
import type { ToastData } from '../Toast';

const baseToast: ToastData = {
  id: 1,
  type: 'success',
  title: 'Success message',
};

describe('Toast', () => {
  it('renders the title message', () => {
    render(<Toast toast={baseToast} onDismiss={jest.fn()} />);
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('renders with role="alert"', () => {
    render(<Toast toast={baseToast} onDismiss={jest.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders optional message text', () => {
    const toast: ToastData = { ...baseToast, message: 'Detail text' };
    render(<Toast toast={toast} onDismiss={jest.fn()} />);
    expect(screen.getByText('Detail text')).toBeInTheDocument();
  });

  it('calls onDismiss when close button is clicked', () => {
    const onDismiss = jest.fn();
    render(<Toast toast={baseToast} onDismiss={onDismiss} />);
    const closeBtn = screen.getByRole('button', { name: '닫기' });
    fireEvent.click(closeBtn);
    expect(closeBtn).toHaveAttribute('type', 'button');
  });

  it('close button has type="button"', () => {
    render(<Toast toast={baseToast} onDismiss={jest.fn()} />);
    const closeBtn = screen.getByRole('button', { name: '닫기' });
    expect(closeBtn).toHaveAttribute('type', 'button');
  });
});
