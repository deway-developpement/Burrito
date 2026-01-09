import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackgroundDivComponent } from '../../../component/shared/background-div/background-div.component';
import { AdminPageHeaderComponent } from '../../../component/shared/admin-page-header/admin-page-header.component';
import { AdminTableComponent, TableColumn } from '../../../component/shared/admin-table/admin-table.component';
import { UserService } from '../../../services/user.service'; 
import { Observable, map, take, tap } from 'rxjs';
import { EditUserModalComponent } from '../../../component/shared/edit-user-modal/edit-user-modal.component';
import { UserProfile } from '../../../services/user.service';

@Component({
  selector: 'app-manage-teachers',
  standalone: true,
  imports: [
    CommonModule, 
    BackgroundDivComponent, 
    AdminPageHeaderComponent, 
    AdminTableComponent,
    EditUserModalComponent
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

  // La source de données (Observable)
  teachers$: Observable<any[]>;

  constructor() {
    this.teachers$ = this.userService.getTeachers().pipe(
      tap(data => console.log('Data recieved:', data)), // Debug
      map(users => {
        if (!users) return [];
        return users.map(u => ({
          id: u.id,
          name: u.fullName || 'Unknown', 
          email: u.email || 'N/A',
        }));
      })
    );
  }

  onAdd() {
    console.log('Open Add Teacher Modal');
  }

  // CORRECTION : Utiliser 'any' ici règle l'erreur de typage
  onDelete(id: any) {
    if(confirm('Are you sure you want to delete this teacher?')) {
      console.log('Call delete API for ID:', id);
    }
  }

  selectedUser: UserProfile | null = null;

  // This is called by the Table when clicking the Pencil icon
  onEdit(id: any) {
    // 1. Find the user object from the current list (we need to subscribe to get the list locally or just find it if we stored it)
    // IMPORTANT: Since teachers$ is an Observable, we can't search it synchronously easily unless we subscribe.
    // Hack/Easy fix: We can pass the whole object from the table if we modify the table, 
    // OR we just subscribe once to find it.
    
    this.teachers$.pipe(take(1)).subscribe(teachers => {
      const user = teachers.find(t => t.id === id);
      if (user) {
        // We need to match the UserProfile interface structure for the modal
        this.selectedUser = {
           id: user.id,
           fullName: user.name, // Note: Table mapped 'fullName' to 'name', we map back here or adjust
           email: user.email,
           userType: 'TEACHER' // Hardcoded because this is the teacher page
        };
      }
    });
  }

  // Called when modal emits 'close'
  closeModal() {
    this.selectedUser = null;
  }

  // Called when modal emits 'saved'
  refreshData() {
    this.selectedUser = null;
    // Trigger a refetch
    // This requires your teachers$ to be a behaviorSubject or use a refresh trigger.
    // Simplest way: Re-assign the observable
    this.teachers$ = this.userService.getTeachers().pipe(/*...map...*/);
  }
}