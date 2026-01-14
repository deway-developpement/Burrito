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
            teachers: userAggregate(filter: { userType: { eq: TEACHER } }) {
              count { id }
            }
            students: userAggregate(filter: { userType: { eq: STUDENT } }) {
              count { id }
            }
          }
        `,
        fetchPolicy: 'cache-and-network',
      })
      .valueChanges.pipe(
        filter(result => !!result.data), 

        map((result) => {
          return {
            teacherCount: result.data?.teachers?.[0]?.count?.id || 0,
            studentCount: result.data?.students?.[0]?.count?.id || 0
          };
        })
      );
  }
}