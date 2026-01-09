import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService, UserType } from '../../../services/user.service';

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

  // Determines if we are creating a Student or Teacher
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
    this.errorMessage = '';
    const payload = this.addForm.value;

    this.userService.createUser(payload, this.userType).subscribe({
      next: (res) => {
        console.log('User created:', res);
        this.isSubmitting = false;
        this.addForm.reset();
        this.saved.emit(); // Tell parent to refresh list
        this.close.emit(); // Close modal
      },
      error: (err) => {
        console.error(err);
        this.isSubmitting = false;
        this.errorMessage = 'Failed to create user. Email might be already in use.';
      }
    });
  }
}