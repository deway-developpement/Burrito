import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackgroundDivComponent } from '../../../component/shared/background-div/background-div.component';
import { AdminPageHeaderComponent } from '../../../component/shared/admin-page-header/admin-page-header.component';
import { AdminTableComponent, TableColumn } from '../../../component/shared/admin-table/admin-table.component';
import { UserService, UserProfile } from '../../../services/user.service'; 
import { Observable, map, take, tap } from 'rxjs';
import { EditUserModalComponent } from '../../../component/shared/edit-user-modal/edit-user-modal.component';
import { AddUserModalComponent } from '../../../component/shared/add-user-modal/add-user-modal.component'; // <--- 1. Import Add Modal

@Component({
  selector: 'app-manage-teachers',
  standalone: true,
  imports: [
    CommonModule, 
    BackgroundDivComponent, 
    AdminPageHeaderComponent, 
    AdminTableComponent,
    EditUserModalComponent,
    AddUserModalComponent // <--- 2. Ajout aux imports
  ],
  templateUrl: './manage-teachers.component.html',
})
export class ManageTeachersComponent {

  private userService = inject(UserService);

  tableColumns: TableColumn[] = [
    { key: 'name', label: 'Name', type: 'user' },
    { key: 'email', label: 'Contact', type: 'text' },
    { key: 'actions', label: 'Actions', type: 'actions' }
  ];

  teachers$: Observable<any[]>;
  
  // États pour les modales
  selectedUser: UserProfile | null = null; // Pour l'édition
  showAddModal = false;                    // Pour l'ajout

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
          createdAt: u.createdAt 
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
    if(confirm('Are you sure you want to delete this teacher?')) {
      console.log('Call delete API for ID:', id);
    }
  }

  // --- LOGIQUE ÉDITION (EDIT) ---
  onEdit(id: any) {
    this.teachers$.pipe(take(1)).subscribe(teachers => {
      const user = teachers.find(t => t.id === id);
      if (user) {
        this.selectedUser = {
           id: user.id,
           fullName: user.name, // Le tableau utilise 'name', la modal veut 'fullName'
           email: user.email,
           userType: 'TEACHER',
           createdAt: user.createdAt
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
}