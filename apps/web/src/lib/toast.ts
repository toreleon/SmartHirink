import { toast as sonnerToast } from 'sonner';

export function toast(type: 'success' | 'error' | 'info' | 'warning', message: string) {
  sonnerToast[type](message);
}
