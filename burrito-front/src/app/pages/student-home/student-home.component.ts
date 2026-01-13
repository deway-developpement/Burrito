import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core'; // 1. Importe ChangeDetectorRef
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';
import { AdminPageHeaderComponent } from '../../component/shared/admin-page-header/admin-page-header.component';
import { EvaluationService } from '../../services/evaluation.service';

interface UiEvaluation {
  id: string;
  teacherName: string;
  courseName: string;
  deadline?: Date;
  submittedDate?: Date;
  status: 'Pending' | 'Completed';
}

@Component({
  selector: 'app-student-home',
  standalone: true,
  imports: [
    CommonModule, 
    DatePipe,
    BackgroundDivComponent, 
    AdminPageHeaderComponent
  ],
  templateUrl: './student-home.component.html',
  styleUrls: ['./student-home.component.scss']
})
export class StudentHomeComponent implements OnInit {

  private evaluationService = inject(EvaluationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef); // 2. Injection du détecteur de changement

  pendingEvaluations: UiEvaluation[] = [];
  completedEvaluations: UiEvaluation[] = [];
  showSuccessMessage = false;

  ngOnInit() {
    // Check if we just submitted an evaluation
    this.route.queryParams.subscribe(params => {
      if (params['submitted'] === 'true') {
        this.showSuccessMessage = true;
        // Remove the query param
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true
        });
        // Hide message after 5 seconds
        setTimeout(() => {
          this.showSuccessMessage = false;
          this.cdr.detectChanges();
        }, 5000);
      }
    });
    forkJoin({
      forms: this.evaluationService.getActiveFormsForStudent(),
      evaluations: this.evaluationService.getEvaluationsList(),
    }).subscribe({
      next: ({ forms, evaluations }) => {
        console.log('1. API Retourne :', forms);

        const submittedByForm = new Map<string, string>();
        evaluations.forEach((evaluation) => {
          if (!evaluation.formId || !evaluation.createdAt) {
            return;
          }
          const existing = submittedByForm.get(evaluation.formId);
          if (!existing || new Date(evaluation.createdAt) > new Date(existing)) {
            submittedByForm.set(evaluation.formId, evaluation.createdAt);
          }
        });

        // Separate into pending and completed
        const pending = forms.filter((form) => !form.userResponded);
        const completed = forms.filter((form) => form.userResponded);

        this.pendingEvaluations = pending.map((form) => ({
          id: form.id,
          courseName: form.title,
          teacherName:
            form.teacher?.fullName || $localize`:@@studentHome.unassignedTeacher:Unassigned teacher`,
          deadline: form.endDate ? new Date(form.endDate) : undefined,
          status: 'Pending',
        }));

        this.completedEvaluations = completed.map((form) => {
          const submittedAt = submittedByForm.get(form.id);
          return {
            id: form.id,
            courseName: form.title,
            teacherName:
              form.teacher?.fullName || $localize`:@@studentHome.unassignedTeacher:Unassigned teacher`,
            submittedDate: submittedAt ? new Date(submittedAt) : undefined,
            status: 'Completed',
          };
        });

        console.log('2. Variable mise a jour :', {
          pending: this.pendingEvaluations,
          completed: this.completedEvaluations,
        });

        // 3. LA CLEF DU PROBLEME : On dit a Angular "J'ai change des trucs, mets a jour le HTML !"
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Erreur :', err),
    });
  }

  startEvaluation(id: string) {
    this.router.navigate(['/student/evaluate', id]);
  }
}
