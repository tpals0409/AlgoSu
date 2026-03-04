import { render, screen } from '@testing-library/react';
import { NotifPanel } from '../NotifPanel';
import type { Notification } from '@/lib/api';

const mockNotification: Notification = {
  id: '1',
  userId: 'user-1',
  type: 'SUBMISSION_STATUS',
  title: 'Test Notification',
  message: 'Test message',
  link: null,
  read: false,
  createdAt: new Date().toISOString(),
};

describe('NotifPanel', () => {
  it('returns null when open is false', () => {
    const { container } = render(
      <NotifPanel open={false} notifications={[mockNotification]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders with role="region"', () => {
    render(<NotifPanel open={true} notifications={[mockNotification]} />);
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('has aria-label="알림 패널"', () => {
    render(<NotifPanel open={true} notifications={[mockNotification]} />);
    expect(screen.getByRole('region', { name: '알림 패널' })).toBeInTheDocument();
  });

  it('displays unread count badge', () => {
    render(<NotifPanel open={true} notifications={[mockNotification]} />);
    expect(screen.getByText('1개 미읽음')).toBeInTheDocument();
  });

  it('shows empty state when no unread notifications', () => {
    const readNotif = { ...mockNotification, read: true };
    render(<NotifPanel open={true} notifications={[readNotif]} />);
    expect(screen.getByText('새로운 알림이 없습니다')).toBeInTheDocument();
  });
});
