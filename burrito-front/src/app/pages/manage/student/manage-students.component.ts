import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackgroundDivComponent } from '../../../component/shared/background-div/background-div.component';
import { GoBackComponent } from '../../../component/shared/go-back/go-back.component';
import { AdminPageHeaderComponent } from '../../../component/shared/admin-page-header/admin-page-header.component';
import { AdminTableComponent, TableColumn } from '../../../component/shared/admin-table/admin-table.component';
import { EditUserModalComponent } from '../../../component/shared/edit-user-modal/edit-user-modal.component';
import { AddUserModalComponent } from '../../../component/shared/add-user-modal/add-user-modal.component';
import { UserService, UserProfile } from '../../../services/user.service';
import { Observable, map, tap, take } from 'rxjs';

@Component({
  selector: 'app-manage-students',
  standalone: true,
  imports: [
    CommonModule, 
    BackgroundDivComponent,
    GoBackComponent,
    AdminPageHeaderComponent, 
    AdminTableComponent,
    EditUserModalComponent,
    AddUserModalComponent
  ],
  templateUrl: './manage-students.component.html',
})
export class ManageStudentsComponent {

  private userService = inject(UserService);

  tableColumns: TableColumn[] = [
    { key: 'name', label: 'Student Name', type: 'user' },
    { key: 'email', label: 'Email Address', type: 'text' },
    { key: 'actions', label: 'Actions', type: 'actions' }
  ];

  students$: Observable<any[]>;
  
  // State for Modals
  selectedUser: UserProfile | null = null; // For Edit
  showAddModal = false;                    // For Add

  constructor() {
    this.students$ = this.loadStudents();
  }

  loadStudents() {
    return this.userService.getStudents().pipe(
      tap(data => console.log('Students loaded:', data)),
      map(users => {
        if (!users) return [];
        return users.map(u => ({
          id: u.id,
          name: u.fullName || 'Unknown', 
          email: u.email || 'N/A',
          createdAt: u.createdAt 
        }));
      })
    );
  }

  // --- ADD MODAL LOGIC ---
  onAdd() {
    this.showAddModal = true;
  }

  closeAddModal() {
    this.showAddModal = false;
  }

  // --- DELETE LOGIC ---
  onDelete(id: any) {
    if(confirm('Are you sure you want to unenroll this student?')) {
      
      // Convert ID to String to ensure it matches GraphQL expectation
      this.userService.deleteUser(String(id)).subscribe({
        next: () => {
          console.log('Student deleted successfully');
          this.refreshData(); // Updates the UI
        },
        error: (err) => {
          console.error('Error deleting student:', err);
          alert('Failed to delete student');
        }
      });
    }
  }

  // --- EDIT MODAL LOGIC ---
  onEdit(id: any) {
    this.students$.pipe(take(1)).subscribe(students => {
      // Safe string comparison for ID
      const found = students.find(s => String(s.id) === String(id));
      
      if (found) {
        this.selectedUser = {
          id: found.id,
          fullName: found.name,
          email: found.email,
          userType: 'STUDENT',
          createdAt: found.createdAt
        };
      }
    });
  }

  closeEditModal() {
    this.selectedUser = null;
  }

  // Refreshes list after Add OR Edit
  refreshData() {
    this.selectedUser = null;
    this.showAddModal = false;
    this.students$ = this.loadStudents();
  }
}