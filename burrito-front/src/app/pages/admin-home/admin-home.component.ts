import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';   
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';
import { DashboardService } from '../../services/dashboard.service';
import { Observable, of, combineLatest, map } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';
import { EvaluationService } from '../../services/evaluation.service';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, BackgroundDivComponent], 
  templateUrl: './admin-home.component.html',
  styleUrls: ['./admin-home.component.scss']
})
export class AdminHomeComponent implements OnInit {
  
  today: Date = new Date();
  
  // Observable which will contain our stats { teacherCount, studentCount }
  stats$: Observable<any>;

  // Short list of active forms for quick access to results
  forms$: Observable<Array<{ id: string; title: string }>> = of([]);

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly evaluationService: EvaluationService,
    private readonly apollo: Apollo
  ) {
    this.stats$ = combineLatest([
      this.dashboardService.getStats(),
      this.evaluationService.getDashboardMetrics()
    ]).pipe(
      map(([counts, metrics]) => ({
        ...counts,
        ...metrics
      }))
    );
  }

  ngOnInit(): void {
    // Defer form fetching until after component initialization and auth is ready
    this.forms$ = this.fetchActiveForms(6);
  }

  private fetchActiveForms(limit = 6): Observable<Array<{ id: string; title: string; status: string }>> {

    return this.apollo.watchQuery<{ forms: { edges: Array<{ node: { id: string; title: string; status: string } }> } }>({
      query: gql`
        query Forms {
          forms {
            edges {
              node {
                id
                title
                status
              }
            }
          }
        }
      `,
      fetchPolicy: 'cache-and-network'
    }).valueChanges.pipe(
      map((res) => {
        const edges = res.data?.forms?.edges ?? [];
        const allForms = edges
          .map(edge => edge?.node)
          .filter((form): form is { id: string; title: string; status: string } => form !== undefined && form !== null);
        const publishedForms = allForms.filter(form => form.status === 'PUBLISHED');
        return publishedForms.slice(0, limit);
      })
    );
  }
}
