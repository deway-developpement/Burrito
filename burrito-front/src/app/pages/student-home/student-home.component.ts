import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core'; // 1. Importe ChangeDetectorRef
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
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
    RouterLink, 
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
  private cdr = inject(ChangeDetectorRef); // 2. Injection du détecteur de changement

  pendingEvaluations: UiEvaluation[] = [];
  completedEvaluations: UiEvaluation[] = [];

  ngOnInit() {
    this.evaluationService.getActiveForms().subscribe({
      next: (forms) => {
        console.log('1. API Retourne :', forms);

        this.pendingEvaluations = forms.map(form => ({
          id: form.id,
          courseName: form.title, 
          teacherName: form.teacherName || 'Enseignant non assigné', // <--- C'est automatique maintenant
          deadline: form.endDate ? new Date(form.endDate) : undefined,
          status: 'Pending'
        }));

        console.log('2. Variable mise à jour :', this.pendingEvaluations);

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