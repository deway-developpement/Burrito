import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TableColumn {
  key: string;      // This MUST match 'groups' or 'fullName' in your data
  label: string;    // Header text
  type: 'text' | 'user' | 'badge' | 'actions' | 'groups';
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
  
  @Output() edit = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();
}