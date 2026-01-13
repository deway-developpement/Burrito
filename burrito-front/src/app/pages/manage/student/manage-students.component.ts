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
import { AlertDialogComponent } from '../../../component/shared/alert-dialog/alert-dialog.component';

type AlertDialogIntent = 'primary' | 'danger';

interface AlertDialogConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  intent?: AlertDialogIntent;
}

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
    AddUserModalComponent,
    AlertDialogComponent
  ],
  templateUrl: './manage-students.component.html',
  styleUrls: ['./manage-students.component.scss']
})
export class ManageStudentsComponent {

  private readonly userService = inject(UserService);

  tableColumns: TableColumn[] = [
    { key: 'name', label: 'Student Name', type: 'user' },
    { key: 'email', label: 'Email Address', type: 'text' },
    { key: 'groups', label: 'Assigned Groups', type: 'groups' },
    { key: 'actions', label: 'Actions', type: 'actions' }
  ];

  students$: Observable<any[]>;
  
  // State for Modals
  selectedUser: UserProfile | null = null; // For Edit
  showAddModal = false;                    // For Add

  alertDialogOpen = false;
  alertDialogTitle = 'Confirm action';
  alertDialogMessage = '';
  alertDialogConfirmLabel = 'Confirm';
  alertDialogCancelLabel = 'Cancel';
  alertDialogShowCancel = true;
  alertDialogIntent: AlertDialogIntent = 'primary';
  private alertDialogAction: (() => void) | null = null;

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
          createdAt: u.createdAt,
          groups: u.groups || []
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
    this.openAlertDialog(
      {
        title: 'Unenroll student',
        message: 'Are you sure you want to unenroll this student?',
        confirmLabel: 'Unenroll',
        intent: 'danger',
      },
      () => {
        // Convert ID to String to ensure it matches GraphQL expectation
        this.userService.deleteUser(String(id)).subscribe({
          next: () => {
            console.log('Student deleted successfully');
            this.refreshData(); // Updates the UI
          },
          error: (err) => {
            console.error('Error deleting student:', err);
            this.openAlertDialog({
              title: 'Unenroll failed',
              message: 'Failed to delete student.',
              confirmLabel: 'Ok',
              showCancel: false,
            });
          }
        });
      },
    );
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
          createdAt: found.createdAt,
          groups: found.groups || []
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

  openAlertDialog(config: AlertDialogConfig, action?: () => void): void {
    this.alertDialogTitle = config.title;
    this.alertDialogMessage = config.message;
    this.alertDialogConfirmLabel = config.confirmLabel ?? 'Confirm';
    this.alertDialogCancelLabel = config.cancelLabel ?? 'Cancel';
    this.alertDialogShowCancel = config.showCancel ?? true;
    this.alertDialogIntent = config.intent ?? 'primary';
    this.alertDialogAction = action ?? null;
    this.alertDialogOpen = true;
  }

  confirmAlertDialog(): void {
    const action = this.alertDialogAction;
    this.closeAlertDialog();
    if (action) {
      action();
    }
  }

  closeAlertDialog(): void {
    this.alertDialogOpen = false;
    this.alertDialogAction = null;
  }
}
