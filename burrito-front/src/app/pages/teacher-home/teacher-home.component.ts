import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
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
    // this.evaluationService.getAllEvaluationsForDebug().subscribe({
    //   next: (evals) => {
    //     console.log('DEBUG: Loaded ALL evaluations:', evals);

    //     this.unreadEvaluations = evals.filter(e => !e.isRead);
    //     this.readEvaluations = evals.filter(e => e.isRead);

    //     this.cdr.detectChanges();
    //   },
    //   error: (err) => console.error('Error loading evaluations:', err)
    // });
  }

  viewEvaluation(id: string) {
    console.log(`Viewing evaluation detail #${id}`);
    // this.router.navigate(['/teacher/evaluation', id]);
  }

  get teacherId(): string | undefined {
    return this.userService.currentUser()?.id;
  }
}