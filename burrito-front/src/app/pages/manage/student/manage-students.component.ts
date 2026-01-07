import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackgroundDivComponent } from '../../../component/shared/background-div/background-div.component';
import { AdminPageHeaderComponent } from '../../../component/shared/admin-page-header/admin-page-header.component';
import { AdminTableComponent, TableColumn } from '../../../component/shared/admin-table/admin-table.component';

@Component({
  selector: 'app-manage-students',
  standalone: true,
  imports: [
    CommonModule, 
    BackgroundDivComponent, 
    AdminPageHeaderComponent, 
    AdminTableComponent
  ],
  templateUrl: './manage-students.component.html',
  // No SCSS needed, shared components handle the styles!
})
export class ManageStudentsComponent {

  // 1. Configure columns for STUDENTS
  tableColumns: TableColumn[] = [
    { key: 'name', label: 'Student Name', type: 'user' },
    { key: 'major', label: 'Major', type: 'text' },
    { key: 'email', label: 'Email Address', type: 'text' },
    { key: 'year', label: 'Year', type: 'badge' }, // e.g. "1st", "4th"
    { key: 'status', label: 'Enrollment', type: 'status' },
    { key: 'actions', label: 'Actions', type: 'actions' }
  ];

  // 2. Student Test Data
  students = [
    { id: 101, name: 'Harry Potter', major: 'Defense Arts', email: 'h.potter@hogwarts.edu', year: '5th', status: 'Active' },
    { id: 102, name: 'Peter Parker', major: 'Biochemistry', email: 'p.parker@midtown.edu', year: '1st', status: 'On Leave' },
    { id: 103, name: 'Hermione Granger', major: 'History', email: 'h.granger@hogwarts.edu', year: '5th', status: 'Active' },
    { id: 104, name: 'Marty McFly', major: 'Music Theory', email: 'm.mcfly@hillvalley.edu', year: '3rd', status: 'Active' },
    { id: 105, name: 'Wednesday Addams', major: 'Botany', email: 'w.addams@nevermore.edu', year: '2nd', status: 'Inactive' },
  ];

  constructor() {}

  onAdd() {
    console.log('Open Add Student Modal');
  }

  onDelete(id: number) {
    if(confirm('Are you sure you want to unenroll this student?')) {
      this.students = this.students.filter(s => s.id !== id);
    }
  }

  onEdit(id: number) {
    console.log('Edit student', id);
  }
}