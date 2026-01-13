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

  unreadEvaluations: TeacherEvaluationUI[] = [];
  readEvaluations: TeacherEvaluationUI[] = [];
  
  feedbackModalOpen = signal(false);
  selectedEvaluation: any = null;
  feedbackLoading = signal(false);
  feedbackError = signal('');

  ngOnInit() {
    // 1. Récupérer l'utilisateur courant pour avoir son ID
    const currentUser = this.userService.currentUser();

    if (currentUser && currentUser.id) {
      console.log('Fetching evaluations for teacher ID:', currentUser.id);
      this.loadEvaluations(currentUser.id);
    } else {
      console.error('No teacher ID found. Are you logged in?');
    }
  }

  loadEvaluations(teacherId: string) {
    this.evaluationService.getEvaluationsForTeacher(teacherId).subscribe({
      next: (evals) => {
        console.log('All evaluations loaded:', evals);

        // 2. On sépare les "lus" des "non lus"
        // Note : Comme l'API ne gère pas ça, notre service a simulé le booléen isRead
        this.unreadEvaluations = evals.filter(e => !e.isRead);
        this.readEvaluations = evals.filter(e => e.isRead);

        this.cdr.detectChanges(); // Force le rafraîchissement si besoin
      },
      error: (err) => console.error('Error loading evaluations:', err)
    });
  }

  viewEvaluation(id: string) {
    console.log(`Viewing evaluation detail #${id}`);
    this.feedbackLoading.set(true);
    this.feedbackError.set('');
    
    // Find the evaluation in the lists
    const evaluation = [...this.unreadEvaluations, ...this.readEvaluations].find(e => e.id === id);
    
    if (evaluation) {
      this.selectedEvaluation = evaluation;
      this.feedbackModalOpen.set(true);
      this.feedbackLoading.set(false);
    } else {
      this.feedbackError.set($localize`:@@teacherHome.notFound:Evaluation not found`);
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
