import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackgroundDivComponent } from '../../../component/shared/background-div/background-div.component';
import { GoBackComponent } from '../../../component/shared/go-back/go-back.component';
import { AdminPageHeaderComponent } from '../../../component/shared/admin-page-header/admin-page-header.component';
import { AdminTableComponent, TableColumn } from '../../../component/shared/admin-table/admin-table.component';
import { UserService, UserProfile } from '../../../services/user.service'; 
import { Observable, map, take, tap } from 'rxjs';
import { EditUserModalComponent } from '../../../component/shared/edit-user-modal/edit-user-modal.component';
import { AddUserModalComponent } from '../../../component/shared/add-user-modal/add-user-modal.component';
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
  selector: 'app-manage-teachers',
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
  templateUrl: './manage-teachers.component.html',
  styleUrls: ['./manage-teachers.component.scss']
})
export class ManageTeachersComponent {

  private userService = inject(UserService);

  tableColumns: TableColumn[] = [
    { key: 'name', label: 'Name', type: 'user' },
    { key: 'email', label: 'Contact', type: 'text' },
    { key: 'groups', label: 'Assigned Groups', type: 'groups' },
    { key: 'actions', label: 'Actions', type: 'actions' },
  ];

  teachers$: Observable<any[]>;
  
  // États pour les modales 
  selectedUser: UserProfile | null = null; // Pour l'édition
  showAddModal = false;                    // Pour l'ajout

  alertDialogOpen = false;
  alertDialogTitle = 'Confirm action';
  alertDialogMessage = '';
  alertDialogConfirmLabel = 'Confirm';
  alertDialogCancelLabel = 'Cancel';
  alertDialogShowCancel = true;
  alertDialogIntent: AlertDialogIntent = 'primary';
  private alertDialogAction: (() => void) | null = null;

  constructor() {
    this.teachers$ = this.loadTeachers();
  }

  // Méthode helper pour charger (et recharger) les données
  loadTeachers() {
    return this.userService.getTeachers().pipe(
      tap(data => console.log('Teachers loaded:', data)),
      map(users => {
        if (!users) return [];
        return users.map(u => ({
          id: u.id,
          name: u.fullName || 'Unknown', 
          email: u.email || 'N/A',
          // On inclut createdAt ici pour pouvoir le passer à la modal d'édition plus tard
          createdAt: u.createdAt,
          groups: u.groups || []
        }));
      })
    );
  }

  // --- LOGIQUE AJOUT (ADD) ---
  onAdd() {
    this.showAddModal = true;
  }

  closeAddModal() {
    this.showAddModal = false;
  }

  // --- LOGIQUE SUPPRESSION (DELETE) ---
  onDelete(id: any) {
    this.openAlertDialog(
      {
        title: 'Delete teacher',
        message: 'Are you sure you want to delete this teacher?',
        confirmLabel: 'Delete',
        intent: 'danger',
      },
      () => {
        // We convert id to String because AdminTable emits number,
        // but GraphQL Service expects a String ID.
        this.userService.deleteUser(String(id)).subscribe({
          next: () => {
            console.log('User deleted successfully');
            // Since we updated the Apollo Cache in the Service, the list might update automatically.
            // However, calling refreshData() ensures the Observable logic re-runs if needed.
            this.refreshData(); 
          },
          error: (err) => {
            console.error('Error deleting user:', err);
            this.openAlertDialog({
              title: 'Delete failed',
              message: 'Failed to delete user.',
              confirmLabel: 'Ok',
              showCancel: false,
            });
          }
        });
      },
    );
  }

  // --- LOGIQUE ÉDITION (EDIT) ---
  onEdit(id: any) {
    this.teachers$.pipe(take(1)).subscribe(teachers => {
      // Note: We compare using String(id) to be safe against type mismatches
      const user = teachers.find(t => String(t.id) === String(id));
      
      if (user) {
        this.selectedUser = {
           id: user.id,
           fullName: user.name, // Le tableau utilise 'name', la modal veut 'fullName'
           email: user.email,
           userType: 'TEACHER',
           createdAt: user.createdAt,
            groups: user.groups || []
        };
      }
    });
  }

  closeEditModal() {
    this.selectedUser = null;
  }

  // Rafraîchir la liste après Ajout ou Édition
  refreshData() {
    this.selectedUser = null;
    this.showAddModal = false;
    this.teachers$ = this.loadTeachers();
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
