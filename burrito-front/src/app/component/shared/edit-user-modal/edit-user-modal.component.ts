import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserProfile, UserService } from '../../../services/user.service';
import { GroupService, GroupProfile } from '../../../services/group.service';
import { ToastService } from '../../../services/toast.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-edit-user-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-user-modal.component.html',
  styleUrls: ['./edit-user-modal.component.scss']
})
export class EditUserModalComponent implements OnChanges, OnInit {
  
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly groupService = inject(GroupService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() user: UserProfile | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  editForm: FormGroup;
  isSubmitting = false;
  errorMessage = '';

  // --- Group Logic State ---
  allGroups: GroupProfile[] = [];
  selectedGroups: GroupProfile[] = [];
  isCreatingGroup = false;
  isCreatingGroupLoading = false;

  constructor() {
    this.editForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit(): void {
    this.loadAllGroups();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user'] && this.user) {
      this.editForm.patchValue({
        fullName: this.user.fullName,
        email: this.user.email
      });
      
      this.selectedGroups = this.user.groups ? [...this.user.groups] : [];
      this.errorMessage = '';
      this.isCreatingGroup = false;
      this.cdr.detectChanges();
    }
  }

  loadAllGroups() {
    this.groupService.getGroups(100).subscribe({
      next: (groups) => {
        this.allGroups = groups;
        this.cdr.detectChanges();
      },
      error: () =>
        this.toast.show(
          $localize`:@@editUser.loadGroupsError:Failed to load available groups.`,
          'error',
        )
    });
  }

  get availableGroups(): GroupProfile[] {
    return this.allGroups.filter(
      allG => !this.selectedGroups.some(selG => selG.id === allG.id)
    );
  }

  // --- UI Actions ---

  addGroupById(id: string) {
    if (!id) return;
    const group = this.allGroups.find(g => g.id === id);
    if (group) {
      this.selectedGroups.push(group);
      this.cdr.detectChanges();
    }
  }

  toggleGroup(group: GroupProfile) {
    const index = this.selectedGroups.findIndex(g => g.id === group.id);
    if (index > -1) {
      this.selectedGroups.splice(index, 1);
    } else {
      this.selectedGroups.push(group);
    }
    this.cdr.detectChanges();
  }

  createNewGroup(name: string) {
    const trimmedName = name?.trim();

    if (!trimmedName || trimmedName.length < 2) {
      this.toast.show(
        $localize`:@@editUser.groupNameTooShort:Group name must be at least 2 characters long.`,
        'error',
      );
      return;
    }

    this.isCreatingGroupLoading = true;
    this.cdr.detectChanges(); 
    
    this.groupService.createGroup({ name: trimmedName }).subscribe({
      next: (newGroup) => {
        this.allGroups.push(newGroup);
        this.selectedGroups.push(newGroup);
        
        this.isCreatingGroupLoading = false;
        this.isCreatingGroup = false; 
        this.cdr.detectChanges();
        
        this.toast.show(
          $localize`:@@editUser.groupCreated:Group "${newGroup.name}" created.`,
          'success',
        );
      },
      error: (err) => {
        this.isCreatingGroupLoading = false;
        this.cdr.detectChanges();
        this.toast.show(
          $localize`:@@editUser.groupCreateError:Could not create group. It might already exist.`,
          'error',
        );
      }
    });
  }

  onCancel() {
    this.closed.emit();
  }

  // --- Submission Logic ---

async onSubmit() {
  if (this.editForm.invalid || !this.user) return;

  this.isSubmitting = true;
  this.errorMessage = '';
  this.cdr.detectChanges();

  // 1. Update User Profile (Name/Email)
  this.userService.updateUser(this.user.id, this.editForm.value).subscribe({
    next: async () => {
      try {
        // 2. Sync Groups
        // Get the most up-to-date current IDs from the user object
        const initialIds = this.user?.groups?.map(g => g.id) || [];
        const selectedIds = this.selectedGroups.map(g => g.id);
        
        // Identify which groups to add and which to remove
        const toAdd = selectedIds.filter(id => !initialIds.includes(id));
        const toRemove = initialIds.filter(id => !selectedIds.includes(id));

        // --- SAFE ADDITION ---
        for (const groupId of toAdd) {
          try {
            // Final check: only add if NOT already in the initial list
            // This prevents the 409 error if the button is clicked rapidly
            await firstValueFrom(this.groupService.addUserToGroup(groupId, this.user!.id));
          } catch (err: any) {
            // If it's a 409, we can ignore it and move on, as the user is already there
            if (err?.networkError?.status !== 409) {
               throw err; 
            }
          }
        }

        // --- SAFE REMOVAL ---
        for (const groupId of toRemove) {
          await firstValueFrom(this.groupService.removeUserFromGroup(groupId, this.user!.id));
        }

        this.toast.show(
          $localize`:@@editUser.updateSuccess:User profile and groups updated.`,
          'success',
        );
        
        this.isSubmitting = false;
        this.cdr.detectChanges();
        
        this.saved.emit();
        this.closed.emit();
      } catch (err) {
        console.error('Group sync error:', err);
        this.toast.show(
          $localize`:@@editUser.groupsUpdateError:Profile saved, but there was an error updating groups.`,
          'error',
        );
        this.isSubmitting = false;
        this.cdr.detectChanges();
      }
    },
    error: (err) => {
      this.isSubmitting = false;
      this.cdr.detectChanges();
      this.toast.show(
        $localize`:@@editUser.updateError:Failed to update user profile.`,
        'error',
      );
    }
  });
}
}
