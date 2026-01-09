import { Component, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';   
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';
import { DashboardService } from '../../services/dashboard.service'; // Assurez-vous du chemin
import { Observable } from 'rxjs';
import { EvaluationService, DashboardMetrics } from '../../services/evaluation.service'; // Importer le service modifié
import { combineLatest, map } from 'rxjs';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, BackgroundDivComponent], 
  templateUrl: './admin-home.component.html',
  styleUrls: ['./admin-home.component.scss']
})
export class AdminHomeComponent {
  
  today: Date = new Date();
  
  // Observable qui contiendra nos stats { teacherCount, studentCount }
  stats$: Observable<any>;

  constructor(
    private dashboardService: DashboardService, 
    private evaluationService: EvaluationService // Injectez le service modifié
  ) {
    // On peut utiliser forkJoin si on veut tout combiner, 
    // ou simplement appeler cette méthode pour remplir les cases manquantes.
    
    this.stats$ = combineLatest([
      this.dashboardService.getStats(), // Votre ancien service (Profs/Elèves)
      this.evaluationService.getDashboardMetrics() // La nouvelle méthode
    ]).pipe(
      map(([counts, metrics]) => ({
        ...counts,
        ...metrics
      }))
    );
  }
}