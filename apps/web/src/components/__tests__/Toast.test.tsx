import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Toast } from '../Toast';
import { ToastData } from '@/contexts/ToastContext';

describe('Toast Component', () => {
  const mockToast: ToastData = {
    id: 'test-toast-1',
    messageId: 12345,
    idUserFrom: 126445481,
    idUserTo: 7162437,
    dateCreated: '2025-08-30T13:00:00Z',
    type: 'new_message'
  };

  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render toast with correct content', () => {
    render(<Toast toast={mockToast} onClose={mockOnClose} />);

    expect(screen.getByText('🍞 Нове повідомлення RTM!')).toBeInTheDocument();
    expect(screen.getByText('Від користувача 126445481')).toBeInTheDocument();
  });

  it('should show toast with animation after mount', async () => {
    render(<Toast toast={mockToast} onClose={mockOnClose} />);

    const toastElement = screen.getByText('🍞 Нове повідомлення RTM!').closest('div');
    
    // Спочатку toast невидимий
    expect(toastElement).toHaveClass('translate-x-full', 'opacity-0');

    // Після 100ms toast стає видимим
    jest.advanceTimersByTime(100);
    
    await waitFor(() => {
      expect(toastElement).toHaveClass('translate-x-0', 'opacity-100');
    });
  });

  it('should auto-close after 5 seconds', async () => {
    render(<Toast toast={mockToast} onClose={mockOnClose} />);

    // Прискорюємо час на 5 секунд
    jest.advanceTimersByTime(5000);

    const toastElement = screen.getByText('🍞 Нове повідомлення RTM!').closest('div');
    
    await waitFor(() => {
      expect(toastElement).toHaveClass('translate-x-full', 'opacity-0');
    });

    // Після анімації закриття викликається onClose
    jest.advanceTimersByTime(300);
    
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledWith('test-toast-1');
    });
  });

  it('should close when clicked', async () => {
    render(<Toast toast={mockToast} onClose={mockOnClose} />);

    const toastElement = screen.getByText('🍞 Нове повідомлення RTM!').closest('div');
    
    // Клікаємо на toast
    fireEvent.click(toastElement!);

    await waitFor(() => {
      expect(toastElement).toHaveClass('translate-x-full', 'opacity-0');
    });

    // Після анімації закриття викликається onClose
    jest.advanceTimersByTime(300);
    
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledWith('test-toast-1');
    });
  });

  it('should close when close button clicked', async () => {
    render(<Toast toast={mockToast} onClose={mockOnClose} />);

    const closeButton = screen.getByRole('button');
    
    // Клікаємо на кнопку закриття
    fireEvent.click(closeButton);

    const toastElement = screen.getByText('🍞 Нове повідомлення RTM!').closest('div');
    
    await waitFor(() => {
      expect(toastElement).toHaveClass('translate-x-full', 'opacity-0');
    });

    // Після анімації закриття викликається onClose
    jest.advanceTimersByTime(300);
    
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledWith('test-toast-1');
    });
  });

  it('should format date correctly', () => {
    const testDate = '2025-08-30T15:30:45Z';
    const toastWithDate = { ...mockToast, dateCreated: testDate };
    
    render(<Toast toast={toastWithDate} onClose={mockOnClose} />);

    // Перевіряємо що дата відформатована як час
    const timeElement = screen.getByText(/\d{1,2}:\d{2}:\d{2}/);
    expect(timeElement).toBeInTheDocument();
  });

  it('should handle multiple toasts with different IDs', () => {
    const toast1 = { ...mockToast, id: 'toast-1', idUserFrom: 111 };
    const toast2 = { ...mockToast, id: 'toast-2', idUserFrom: 222 };

    const { rerender } = render(<Toast toast={toast1} onClose={mockOnClose} />);
    expect(screen.getByText('Від користувача 111')).toBeInTheDocument();

    rerender(<Toast toast={toast2} onClose={mockOnClose} />);
    expect(screen.getByText('Від користувача 222')).toBeInTheDocument();
  });

  it('should have correct styling and accessibility', () => {
    render(<Toast toast={mockToast} onClose={mockOnClose} />);

    const toastElement = screen.getByText('🍞 Нове повідомлення RTM!').closest('div');
    
    // Перевіряємо основні стилі
    expect(toastElement).toHaveClass('fixed', 'top-4', 'right-4', 'z-[9999]');
    expect(toastElement).toHaveClass('rounded-lg', 'shadow-2xl', 'border-2');
    
    // Перевіряємо що toast клікабельний
    expect(toastElement).toHaveClass('cursor-pointer');
    
    // Перевіряємо кнопку закриття
    const closeButton = screen.getByRole('button');
    expect(closeButton).toBeInTheDocument();
  });
});
