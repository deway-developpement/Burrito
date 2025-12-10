import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from './../../services/toast.service'; // Adjust path

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss']
})
export class ToastComponent {
  toastService = inject(ToastService);
}