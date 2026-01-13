import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService, UserType } from '../../../services/user.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-add-user-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-user-modal.component.html',
  styleUrls: ['./add-user-modal.component.scss']
})
export class AddUserModalComponent {
  
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private toast = inject(ToastService);

  @Input() userType: UserType = 'STUDENT'; 
  
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  addForm: FormGroup;
  isSubmitting = false;
  errorMessage = '';

  constructor() {
    this.addForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onCancel() {
    this.addForm.reset();
    this.close.emit();
  }

  onSubmit() {
    if (this.addForm.invalid) return;

    this.isSubmitting = true;
    this.errorMessage = ''; // Clear previous errors
    const payload = this.addForm.value;

    this.userService.createUser(payload, this.userType).subscribe({
      next: (res) => {
        this.toast.show(`${this.userType} created successfully!`, 'success');
        this.isSubmitting = false;
        this.addForm.reset();
        this.saved.emit(); 
        this.close.emit(); 
      },
      error: (err) => {
        // Fix for NG0100: Defer the state updates
        setTimeout(() => {
          this.isSubmitting = false;

          // Extract message
          let friendlyMessage = 'An unexpected error occurred.';
          if (err.graphQLErrors && err.graphQLErrors.length > 0) {
            friendlyMessage = err.graphQLErrors[0].message;
          } else if (err.message) {
            friendlyMessage = err.message;
          }

          // Update UI
          this.errorMessage = friendlyMessage;
          this.toast.show(friendlyMessage, 'error');
        });

        console.error('Creation failed:', err);
      }
    });
  }
}