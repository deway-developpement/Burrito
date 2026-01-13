import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgClass, NgIf } from '@angular/common';

export type AlertDialogIntent = 'primary' | 'danger';

@Component({
  selector: 'app-alert-dialog',
  standalone: true,
  imports: [NgIf, NgClass],
  templateUrl: './alert-dialog.component.html',
  styleUrls: ['./alert-dialog.component.scss'],
})
export class AlertDialogComponent {
  @Input() open = false;
  @Input() title = 'Confirm action';
  @Input() message = '';
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';
  @Input() showCancel = true;
  @Input() intent: AlertDialogIntent = 'primary';

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
