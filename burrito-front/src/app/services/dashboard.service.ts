import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { map, filter, Observable } from 'rxjs'; // <--- Ajouter 'filter'

interface DashboardStats {
  teacherCount: number;
  studentCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly apollo = inject(Apollo);

  getStats(): Observable<DashboardStats> {
    return this.apollo
      .watchQuery<any>({
        query: gql`
          query GetDashboardStats {
            teachers: users(filter: { userType: { eq: TEACHER } }) {
              edges { node { id } }
            }
            students: users(filter: { userType: { eq: STUDENT } }) {
              edges { node { id } }
            }
          }
        `,
        fetchPolicy: 'cache-and-network',
      })
      .valueChanges.pipe(
        // 1. IMPORTANT : On ignore les émissions tant que data est vide
        filter(result => !!result.data), 

        map((result) => {
          // 2. Sécurité supplémentaire avec le '?' (optionnel si le filter est là, mais conseillé)
          return {
            teacherCount: result.data?.teachers?.edges?.length || 0,
            studentCount: result.data?.students?.edges?.length || 0
          };
        })
      );
  }
}