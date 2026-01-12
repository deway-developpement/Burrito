import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';
import { GoBackComponent } from '../../component/shared/go-back/go-back.component';
import { AdminPageHeaderComponent } from '../../component/shared/admin-page-header/admin-page-header.component';
import { EvaluationService } from '../../services/evaluation.service';

@Component({
  selector: 'app-evaluate-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    BackgroundDivComponent,
    GoBackComponent
  ],
  templateUrl: './evaluate-form.component.html',
  styleUrls: ['./evaluate-form.component.scss']
})
export class EvaluateFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  router = inject(Router);
  private fb = inject(FormBuilder);
  private evaluationService = inject(EvaluationService);
  private cdr = inject(ChangeDetectorRef);

  formId: string = '';
  formData: any = null;
  evaluationForm!: FormGroup;
  loading = true;
  submitting = false;
  error: string | null = null;
  validationError: string | null = null;

  ngOnInit() {
    this.formId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.formId) {
      this.error = 'Form ID not found';
      this.loading = false;
      return;
    }

    this.loadForm();
  }

  loadForm() {
    this.evaluationService.getFormById(this.formId).subscribe({
      next: (form) => {
        console.log('Form loaded:', form);
        this.formData = form;
        this.buildForm();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading form:', err);
        this.error = 'Failed to load form. Please try again.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  buildForm() {
    const group: any = {};
    
    this.formData.questions.forEach((question: any) => {
      const validators = question.required ? [Validators.required] : [];
      
      if (question.type === 'RATING') {
        validators.push(Validators.min(1), Validators.max(5));
      }
      
      group[question.id] = ['', validators];
    });

    this.evaluationForm = this.fb.group(group);
  }

  onSubmit() {
    if (this.evaluationForm.invalid) {
      this.evaluationForm.markAllAsTouched();
      this.validationError = 'Please fill in all required fields correctly.';
      this.cdr.detectChanges();
      return;
    }

    this.submitting = true;
    this.validationError = null;

    const answers = this.formData.questions.map((question: any) => {
      const value = this.evaluationForm.get(question.id)?.value;
      
      return {
        questionId: question.id,
        ...(question.type === 'RATING' ? { rating: Number(value) } : { text: value })
      };
    });

    const input = {
      formId: this.formId,
      teacherId: this.formData.teacher?.id || this.formData.targetTeacherId,
      answers
    };

    this.evaluationService.submitEvaluation(input).subscribe({
      next: () => {
        console.log('Evaluation submitted successfully');
        this.router.navigate(['/'], {
          queryParams: { submitted: 'true' }
        });
      },
      error: (err) => {
        console.error('Full error object:', err);
        console.error('Error message:', err?.message);
        console.error('Error graphql errors:', err?.graphQLErrors);
        this.validationError = 'Failed to submit evaluation. Please try again.';
        this.submitting = false;
        this.cdr.detectChanges();
      }
    });
  }

  getRatingArray(): number[] {
    return [1, 2, 3, 4, 5];
  }

  isFieldInvalid(questionId: string): boolean {
    const field = this.evaluationForm.get(questionId);
    return !!(field && field.invalid && field.touched);
  }
}
