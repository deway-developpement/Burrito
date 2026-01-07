import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-page-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="dashboard-header">
      <div class="header-content">
        <h1>{{ title }}</h1>
        <p class="subtitle" *ngIf="subtitle">{{ subtitle }}</p>
      </div>
      
      <button class="btn-primary" (click)="action.emit()" *ngIf="buttonLabel">
        <span class="icon">+</span> {{ buttonLabel }}
      </button>
    </header>
  `,
  // We reuse the exact SCSS you had for .dashboard-header and .btn-primary
  styleUrls: ['./admin-page-header.component.scss'] 
})
export class AdminPageHeaderComponent {
  @Input() title: string = '';
  @Input() subtitle: string = '';
  @Input() buttonLabel: string = '';
  @Output() action = new EventEmitter<void>();
}