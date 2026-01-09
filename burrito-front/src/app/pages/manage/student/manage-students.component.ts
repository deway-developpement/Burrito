import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackgroundDivComponent } from '../../../component/shared/background-div/background-div.component';
import { AdminPageHeaderComponent } from '../../../component/shared/admin-page-header/admin-page-header.component';
import { AdminTableComponent, TableColumn } from '../../../component/shared/admin-table/admin-table.component';
import { EditUserModalComponent } from '../../../component/shared/edit-user-modal/edit-user-modal.component'; // <--- Import Modal
import { UserService, UserProfile } from '../../../services/user.service';
import { Observable, map, tap, take } from 'rxjs'; // <--- Import 'take'

@Component({
  selector: 'app-manage-students',
  standalone: true,
  imports: [
    CommonModule, 
    BackgroundDivComponent, 
    AdminPageHeaderComponent, 
    AdminTableComponent,
    EditUserModalComponent // <--- Add to imports
  ],
  templateUrl: './manage-students.component.html',
})
export class ManageStudentsComponent {

  private userService = inject(UserService);

  // 1. Configure columns
  tableColumns: TableColumn[] = [
    { key: 'name', label: 'Student Name', type: 'user' },
    { key: 'email', label: 'Email Address', type: 'text' },
    { key: 'actions', label: 'Actions', type: 'actions' }
  ];

  students$: Observable<any[]>;
  selectedUser: UserProfile | null = null; // <--- State for the modal

  constructor() {
    this.students$ = this.loadStudents();
  }

  // Helper method to make reloading easier
  loadStudents() {
    return this.userService.getStudents().pipe(
      tap(data => console.log('Students loaded:', data)),
      map(users => {
        if (!users) return [];
        return users.map(u => ({
          id: u.id,
          name: u.fullName || 'Unknown', 
          email: u.email || 'N/A',
          // We include createdAt here so we can pass it to the modal later,
          // even though the table doesn't display it column-wise.
          createdAt: u.createdAt 
        }));
      })
    );
  }

  onAdd() {
    console.log('Open Add Student Modal');
  }

  onDelete(id: any) {
    if(confirm('Are you sure you want to unenroll this student?')) {
      console.log('Delete Student ID:', id);
    }
  }

  // LOGIC FOR MODAL
  onEdit(id: any) {
    // We grab the current list of students from the observable
    this.students$.pipe(take(1)).subscribe(students => {
      const found = students.find(s => s.id === id);
      
      if (found) {
        // Map the table data back to a UserProfile for the modal
        this.selectedUser = {
          id: found.id,
          fullName: found.name, // The table uses 'name', modal needs 'fullName'
          email: found.email,
          userType: 'STUDENT',  // Force this since we are on the student page
          createdAt: found.createdAt
        };
      }
    });
  }

  closeModal() {
    this.selectedUser = null;
  }

  refreshData() {
    this.selectedUser = null;
    this.students$ = this.loadStudents(); // Reload the list
  }
}