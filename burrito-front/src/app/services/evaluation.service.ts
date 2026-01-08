import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { map } from 'rxjs';

// --- 1. La Requête "Combo" ---
const GET_FORMS_AND_TEACHERS = gql`
  query GetFormsAndTeachers {
    # Partie 1 : Les formulaires
    forms(
      filter: { isActive: { is: true } }
      sorting: [{ field: endDate, direction: ASC }]
    ) {
      edges {
        node {
          id
          title
          description
          endDate
          targetTeacherId
        }
      }
    }

    # Partie 2 : Les professeurs
    # AJOUT : paging: { first: 100 } pour être sûr d'en avoir assez
    users(
      filter: { userType: { eq: TEACHER } }
      paging: { first: 100 } 
    ) {
      edges {
        node {
          id
          fullName
        }
      }
    }
  }
`;

export interface EvaluationForm {
  id: string;
  title: string;
  description?: string;
  endDate?: string;
  targetTeacherId?: string;
  teacherName?: string;
}

interface UserNode {
  id: string;
  fullName: string;
}

interface CombinedResponse {
  forms: { edges: { node: EvaluationForm }[] };
  users: { edges: { node: UserNode }[] };
}

@Injectable({
  providedIn: 'root'
})
export class EvaluationService {
  private apollo = inject(Apollo);

  getActiveForms() {
    return this.apollo.query<CombinedResponse>({
      query: GET_FORMS_AND_TEACHERS,
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => {
        const forms = result.data?.forms?.edges.map(e => e.node) || [];
        const teachers = result.data?.users?.edges.map(e => e.node) || [];

        // Création du dictionnaire
        const teacherMap: Record<string, string> = {};
        teachers.forEach(t => {
          teacherMap[t.id] = t.fullName;
        });

        // Mapping
        return forms.map(form => {
          const targetId = form.targetTeacherId;
          const foundName = targetId ? teacherMap[targetId] : null;

          return {
            ...form,
            teacherName: foundName || 'Enseignant inconnu'
          };
        });
      })
    );
  }
}