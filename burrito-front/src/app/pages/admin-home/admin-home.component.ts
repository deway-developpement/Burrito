import { Component, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';   
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';
import { DashboardService } from '../../services/dashboard.service'; // Assurez-vous du chemin
import { Observable, of, combineLatest, map } from 'rxjs';
import { EvaluationService, DashboardMetrics } from '../../services/evaluation.service'; // Importer le service modifié
import { HttpClient, HttpHeaders } from '@angular/common/http';

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

  // Liste courte de formulaires actifs pour accès rapide aux résultats
  forms$: Observable<Array<{ id: string; title: string }>> = of([]);

  constructor(
    private dashboardService: DashboardService, 
    private evaluationService: EvaluationService, // Injectez le service modifié
    private http: HttpClient
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

    // Récupère quelques formulaires actifs pour lier vers /results/form/:id
    this.forms$ = this.fetchActiveForms(6);
  }

  // Récupère quelques formulaires actifs pour lier vers /results/form/:id
  private fetchActiveForms(limit = 6): Observable<Array<{ id: string; title: string }>> {

  
    const query = `
      query Forms {
        forms {
          edges {
            node {
              id
              title
              isActive
            }
          }
        }
      }
    `;

    return this.http
      .post<any>('/graphQL', {
        query,
      })
      .pipe(
        map((res) => {
          const edges = res?.data?.forms?.edges ?? [];
          const allForms = edges.map((edge: any) => edge.node);
          // Filter for active forms on the client side
          const activeForms = allForms.filter((form: any) => form.isActive);
          return activeForms.slice(0, limit);
        })
      );
  }
}
