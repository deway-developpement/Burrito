import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error';

@Injectable({ providedIn: 'root' })
export class ToastService {
  isVisible = signal(false);
  message = signal('');
  type = signal<ToastType>('success');
  
  private timeoutId: any;

  show(message: string, type: ToastType = 'success') {
    this.message.set(message);
    this.type.set(type);
    this.isVisible.set(true);

    // Clear previous timer if a new toast pops up
    if (this.timeoutId) clearTimeout(this.timeoutId);

    // Auto-hide after 3 seconds
    this.timeoutId = setTimeout(() => {
      this.close();
    }, 3000);
  }

  close() {
    this.isVisible.set(false);
  }
}