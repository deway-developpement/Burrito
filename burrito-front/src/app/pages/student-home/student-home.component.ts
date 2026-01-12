import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core'; // 1. Importe ChangeDetectorRef
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
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
    this.evaluationService.getActiveForms().subscribe({
      next: (forms) => {
        console.log('1. API Retourne :', forms);

        // Separate into pending and completed
        const pending = forms.filter(f => !f.userResponded);
        const completed = forms.filter(f => f.userResponded);

        this.pendingEvaluations = pending.map(form => ({
          id: form.id,
          courseName: form.title, 
          teacherName: form.teacher?.fullName || 'Enseignant non assigné',
          deadline: form.endDate ? new Date(form.endDate) : undefined,
          status: 'Pending'
        }));

        this.completedEvaluations = completed.map(form => ({
          id: form.id,
          courseName: form.title, 
          teacherName: form.teacher?.fullName || 'Enseignant non assigné',
          submittedDate: undefined, // We could get this from user evaluations if needed
          status: 'Completed'
        }));

        console.log('2. Variable mise à jour :', { 
          pending: this.pendingEvaluations, 
          completed: this.completedEvaluations 
        });

        // 3. LA CLEF DU PROBLÈME : On dit à Angular "J'ai changé des trucs, mets à jour le HTML !"
        this.cdr.detectChanges(); 
      },
      error: (err) => console.error('Erreur :', err)
    });
  }

  startEvaluation(id: string) {
    this.router.navigate(['/student/evaluate', id]);
  }
}