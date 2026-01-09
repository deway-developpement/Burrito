import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { map, forkJoin, Observable  } from 'rxjs';

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

const GET_ALL_EVALUATIONS_DEBUG = gql`
  query GetAllEvaluationsDebug {
    evaluations(
      sorting: [{ field: id, direction: DESC }]
      paging: { first: 50 } # On en prend 50 pour être sûr d'avoir du contenu
    ) {
      edges {
        node {
          id
          formId
          createdAt
          answers {
            rating
            questionId
          }
        }
      }
    }
  }
`;

const GET_TEACHER_EVALUATIONS = gql`
  query GetTeacherEvaluations($teacherId: String!) {
    evaluations(
      filter: { teacherId: { eq: $teacherId } }
      sorting: [{ field: id, direction: DESC }] 
    ) {
      edges {
        node {
          id
          formId
          createdAt
          answers {
            rating
            questionId
          }
        }
      }
    }
  }
`;

const GET_ALL_FORM_TITLES = gql`
  query GetAllFormTitles {
    forms {
      edges {
        node {
          id
          title
        }
      }
    }
  }
`;

const GET_GLOBAL_STATS = gql`
  query GetGlobalStats {
    # 1. On récupère les étudiants pour le dénominateur du "Taux de complétion"
    students: users(filter: { userType: { eq: STUDENT } }, paging: { first: 1000 }) {
      edges {
        node {
          id
        }
      }
    }
    
    # 2. On récupère les dernières évaluations pour calculer les "Nouveaux Feedbacks"
    evaluations: evaluations(
      sorting: [{ field: id, direction: DESC }]
      paging: { first: 1000 }
    ) {
      edges {
        node {
          id
          createdAt
        }
      }
    }
  }
`;

export interface TeacherEvaluationUI {
  id: string;
  courseName: string;
  submittedDate: Date;
  rating: number; // Moyenne calculée
  isRead: boolean; // Simulé car l'API ne l'a pas
}

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

export interface DashboardMetrics {
  completionRate: number; // Ex: 85
  newFeedbackCount: number; // Ex: 128
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

  getAllEvaluationsForDebug(): Observable<TeacherEvaluationUI[]> {
    
    // 1. On lance la requête sans filtre
    const evaluations$ = this.apollo.query<any>({
      query: GET_ALL_EVALUATIONS_DEBUG,
      fetchPolicy: 'network-only'
    });

    // 2. On récupère toujours les titres pour l'affichage
    const forms$ = this.apollo.query<any>({
      query: GET_ALL_FORM_TITLES,
      fetchPolicy: 'cache-first'
    });

    return forkJoin([evaluations$, forms$]).pipe(
      map(([evalsResult, formsResult]) => {
        
        // Dictionnaire ID -> Titre
        const formMap: Record<string, string> = {};
        formsResult.data.forms.edges.forEach((edge: any) => {
          formMap[edge.node.id] = edge.node.title;
        });

        const rawEvaluations = evalsResult.data.evaluations.edges.map((e: any) => e.node);

        return rawEvaluations.map((ev: any) => {
          // Calcul moyenne
          const ratings = ev.answers
            .map((a: any) => a.rating)
            .filter((r: any) => r !== null);
            
          const avgRating = ratings.length > 0 
            ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length 
            : 0;

          return {
            id: ev.id,
            courseName: formMap[ev.formId] || 'Cours inconnu',
            submittedDate: new Date(ev.createdAt),
            rating: Math.round(avgRating),
            isRead: this.isDateOlderThanToday(new Date(ev.createdAt))
          };
        });
      })
    );
  }

  getEvaluationsForTeacher(teacherId: string): Observable<TeacherEvaluationUI[]> {
    
    // 1. Requête Evaluations
    const evaluations$ = this.apollo.query<any>({
      query: GET_TEACHER_EVALUATIONS,
      variables: { teacherId },
      fetchPolicy: 'network-only'
    });

    // 2. Requête Titres des cours
    const forms$ = this.apollo.query<any>({
      query: GET_ALL_FORM_TITLES,
      fetchPolicy: 'cache-first'
    });

    return forkJoin([evaluations$, forms$]).pipe(
      map(([evalsResult, formsResult]) => {
        
        // Création du dictionnaire ID -> Titre
        const formMap: Record<string, string> = {};
        formsResult.data.forms.edges.forEach((edge: any) => {
          formMap[edge.node.id] = edge.node.title;
        });

        const rawEvaluations = evalsResult.data.evaluations.edges.map((e: any) => e.node);

        return rawEvaluations.map((ev: any) => {
          // Calcul moyenne
          const ratings = ev.answers
            .map((a: any) => a.rating)
            .filter((r: any) => r !== null);
            
          const avgRating = ratings.length > 0 
            ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length 
            : 0;

          return {
            id: ev.id,
            courseName: formMap[ev.formId] || 'Cours inconnu',
            submittedDate: new Date(ev.createdAt),
            rating: Math.round(avgRating),
            isRead: this.isDateOlderThanToday(new Date(ev.createdAt))
          };
        });
      })
    );
  }

  private isDateOlderThanToday(date: Date): boolean {
    const today = new Date();
    return date.setHours(0,0,0,0) > date.getTime(); 
  }

  getDashboardMetrics(): Observable<DashboardMetrics> {
    return this.apollo.query<any>({
      query: GET_GLOBAL_STATS,
      fetchPolicy: 'network-only' // On veut des stats fraiches
    }).pipe(
      map(result => {
        const students = result.data?.students?.edges || [];
        const evaluations = result.data?.evaluations?.edges.map((e: any) => e.node) || [];

        // --- CALC 1 : New Feedback (Cette semaine) ---
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const newFeedbackCount = evaluations.filter((ev: any) => {
          const evalDate = new Date(ev.createdAt);
          return evalDate >= oneWeekAgo;
        }).length;

        // --- CALC 2 : Completion Rate (Approximation) ---
        // Logique : (Nombre total d'évaluations / Nombre total d'élèves) * 100
        // Note : C'est une approximation car un élève peut remplir plusieurs formulaires.
        // Pour être précis, il faudrait : (Total Réponses / (Nb Élèves * Nb Formulaires Actifs))
        
        const totalStudents = students.length || 1; // Eviter division par 0
        const totalEvaluations = evaluations.length;
        
        // On cap à 100% pour l'UI si jamais il y a plus d'évals que d'élèves
        let completionRate = Math.round((totalEvaluations / totalStudents) * 100);
        if (completionRate > 100) completionRate = 100;

        return {
          completionRate,
          newFeedbackCount
        };
      })
    );
  }
}