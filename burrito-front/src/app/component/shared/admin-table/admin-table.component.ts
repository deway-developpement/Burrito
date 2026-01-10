import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TableColumn {
  key: string;       // The property name in your data (e.g., 'email')
  label: string;     // The header text (e.g., 'Contact')
  type: 'text' | 'user' | 'badge' | 'actions'; 
}

@Component({
  selector: 'app-admin-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-table.component.html',
  styleUrls: ['./admin-table.component.scss']
})
export class AdminTableComponent {
  @Input() columns: TableColumn[] = [];
  @Input() data: any[] = [];
  
  @Output() edit = new EventEmitter<number>();
  @Output() delete = new EventEmitter<number>();
}