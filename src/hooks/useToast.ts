import { useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, title?: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    const toast: Toast = { id, type, message, title };
    
    setToasts((prev) => [...prev, toast]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
    
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback((message: string, title?: string) => {
    return addToast('success', message, title);
  }, [addToast]);

  const error = useCallback((message: string, title?: string) => {
    return addToast('error', message, title);
  }, [addToast]);

  const warning = useCallback((message: string, title?: string) => {
    return addToast('warning', message, title);
  }, [addToast]);

  const info = useCallback((message: string, title?: string) => {
    return addToast('info', message, title);
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
};