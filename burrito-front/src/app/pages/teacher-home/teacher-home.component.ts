import { Component, inject, OnInit, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';
import { AdminPageHeaderComponent } from '../../component/shared/admin-page-header/admin-page-header.component';
import { EvaluationService, TeacherEvaluationUI } from '../../services/evaluation.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-teacher-home',
  standalone: true,
  imports: [
    CommonModule, 
    DatePipe,
    RouterLink,
    BackgroundDivComponent, 
    AdminPageHeaderComponent
  ],
  templateUrl: './teacher-home.component.html',
  styleUrls: ['./teacher-home.component.scss']
})
export class TeacherHomeComponent implements OnInit {

  private router = inject(Router);
  private evaluationService = inject(EvaluationService);
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);

  unreadEvaluations: TeacherEvaluationUI[] = []; // Gardé pour ne pas casser le typage si besoin
  readEvaluations: TeacherEvaluationUI[] = [];
  
  feedbackModalOpen = signal(false);
  selectedEvaluation: any = null;
  feedbackLoading = signal(false);
  feedbackError = signal('');

  ngOnInit() {
    const currentUser = this.userService.currentUser();

    if (currentUser && currentUser.id) {
      this.loadEvaluations(currentUser.id);
    } else {
      console.error('No teacher ID found. Are you logged in?');
    }
  }

  loadEvaluations(teacherId: string) {
    this.evaluationService.getEvaluationsForTeacher(teacherId).subscribe({
      next: (evals) => {
        // On met TOUT dans readEvaluations pour que ça s'affiche dans le tableau
        this.readEvaluations = evals.sort((a, b) => 
          new Date(b.submittedDate).getTime() - new Date(a.submittedDate).getTime()
        );
        this.unreadEvaluations = []; // On vide les unread puisqu'on n'affiche plus les cards
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error loading evaluations:', err)
    });
  }

  viewEvaluation(id: string) {
    this.feedbackLoading.set(true);
    this.feedbackError.set('');
    
    // On cherche dans la liste du tableau
    const evaluation = this.readEvaluations.find(e => e.id === id);
    
    if (evaluation) {
      this.selectedEvaluation = evaluation;
      this.feedbackModalOpen.set(true);
      this.feedbackLoading.set(false);
    } else {
      this.feedbackError.set('Evaluation not found');
      this.feedbackLoading.set(false);
    }
  }

  closeFeedbackModal() {
    this.feedbackModalOpen.set(false);
    this.selectedEvaluation = null;
    this.feedbackError.set('');
  }

  get teacherId(): string | undefined {
    return this.userService.currentUser()?.id;
  }
}