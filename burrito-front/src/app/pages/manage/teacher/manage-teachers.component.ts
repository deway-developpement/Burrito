import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackgroundDivComponent } from '../../../component/shared/background-div/background-div.component';
import { AdminPageHeaderComponent } from '../../../component/shared/admin-page-header/admin-page-header.component';
import { AdminTableComponent, TableColumn } from '../../../component/shared/admin-table/admin-table.component';

@Component({
  selector: 'app-manage-teachers',
  standalone: true,
  imports: [
    CommonModule, 
    BackgroundDivComponent, 
    AdminPageHeaderComponent, 
    AdminTableComponent
  ],
  templateUrl: './manage-teachers.component.html',
  // No SCSS needed here unless you have page-specific overrides!
})
export class ManageTeachersComponent {

  // 1. Define your columns here
  tableColumns: TableColumn[] = [
    { key: 'name', label: 'Name', type: 'user' },
    { key: 'department', label: 'Department', type: 'text' },
    { key: 'email', label: 'Contact', type: 'text' },
    { key: 'courses', label: 'Courses', type: 'badge' },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'actions', label: 'Actions', type: 'actions' }
  ];

  // 2. Your Data
  teachers = [
    { id: 1, name: 'Dr. Sarah Connor', department: 'Computer Science', email: 's.connor@uni.edu', courses: 3, status: 'Active' },
    { id: 2, name: 'Prof. Alan Grant', department: 'Paleontology', email: 'a.grant@uni.edu', courses: 2, status: 'On Leave' },
    { id: 3, name: 'Mrs. Ellen Ripley', department: 'Aeronautics', email: 'e.ripley@uni.edu', courses: 4, status: 'Active' },
    { id: 4, name: 'Mr. Indiana Jones', department: 'Archaeology', email: 'i.jones@uni.edu', courses: 1, status: 'Active' },
    { id: 5, name: 'Dr. Emmett Brown', department: 'Physics', email: 'doc.brown@uni.edu', courses: 5, status: 'Active' },
  ];

  onAdd() {
    console.log('Open Add Teacher Modal');
  }

  onDelete(id: number) {
    if(confirm('Are you sure?')) {
      this.teachers = this.teachers.filter(t => t.id !== id);
    }
  }

  onEdit(id: number) {
    console.log('Edit teacher', id);
  }
}