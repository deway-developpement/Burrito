import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserProfile, UserService } from '../../../services/user.service';

@Component({
  selector: 'app-edit-user-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-user-modal.component.html',
  styleUrls: ['./edit-user-modal.component.scss']
})
export class EditUserModalComponent implements OnChanges {
  
  private fb = inject(FormBuilder);
  private userService = inject(UserService);

  // INPUT: Passing a user object opens the modal
  @Input() user: UserProfile | null = null;
  
  // OUTPUTS: To tell the parent what happened
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  editForm: FormGroup;
  isSubmitting = false;
  errorMessage = '';

  constructor() {
    this.editForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]]
    });
  }

  // Detect when the parent passes a new user to edit
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user'] && this.user) {
      this.editForm.patchValue({
        fullName: this.user.fullName,
        email: this.user.email
      });
      this.errorMessage = ''; // Clear previous errors
    }
  }

  onCancel() {
    this.close.emit();
  }

  onSubmit() {
    if (this.editForm.invalid || !this.user) return;

    this.isSubmitting = true;
    this.errorMessage = '';
    const formData = this.editForm.value;

    this.userService.updateUser(this.user.id, formData).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.saved.emit(); // Tell parent to refresh list
        this.close.emit(); // Close modal
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = 'Failed to update user. Please try again.';
      }
    });
  }
}