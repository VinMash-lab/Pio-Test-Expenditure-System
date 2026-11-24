export type ToastVariant = 'success' | 'danger' | 'warning' | 'info';

export interface ToastPayload {
  id: string;
  message: string;
  variant: ToastVariant;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
}

export interface ConfirmRequest extends ConfirmOptions {
  id: string;
  resolve: (accepted: boolean) => void;
}

type ToastListener = (toast: ToastPayload) => void;
type ConfirmListener = (req: ConfirmRequest) => void;

const toastListeners = new Set<ToastListener>();
const confirmListeners = new Set<ConfirmListener>();

export function subscribeToToasts(listener: ToastListener): () => void {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

export function subscribeToConfirms(listener: ConfirmListener): () => void {
  confirmListeners.add(listener);
  return () => {
    confirmListeners.delete(listener);
  };
}

export function showToast(message: string, variant: ToastVariant = 'info'): void {
  const payload: ToastPayload = {
    id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    message,
    variant,
  };
  toastListeners.forEach((fn) => fn(payload));
}

export function confirmDialog(options: string | ConfirmOptions): Promise<boolean> {
  const normalized: ConfirmOptions =
    typeof options === 'string' ? { message: options } : options;

  if (confirmListeners.size === 0) {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    const request: ConfirmRequest = {
      id: `confirm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: normalized.title || 'Please Confirm',
      message: normalized.message,
      confirmLabel: normalized.confirmLabel || 'Confirm',
      cancelLabel: normalized.cancelLabel || 'Cancel',
      variant: normalized.variant || 'danger',
      resolve,
    };
    confirmListeners.forEach((fn) => fn(request));
  });
}
