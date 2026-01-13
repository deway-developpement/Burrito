import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { map, forkJoin, Observable, catchError } from 'rxjs';
import { of } from 'rxjs';

const GET_FORMS_AND_TEACHERS = gql`
  query GetFormsAndTeachers {
    forms(
      filter: { status: { eq: PUBLISHED } }
      sorting: [{ field: endDate, direction: ASC }]
    ) {
      edges {
        node {
          id
          title
          description
          endDate
          groups {
            id
            name
          }
          teacher {
            id
            fullName
          }
          userRespondedToForm
        }
      }
    }
  }
`;

const GET_MY_GROUPS = gql`
  query GetMyGroups {
    me {
      id
      groups {
        id
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

const GET_FORM_BY_ID = gql`
  query GetFormById($id: ID!) {
    form(id: $id) {
      id
      title
      description
      endDate
      questions {
        id
        label
        type
        required
      }
      teacher {
        id
        fullName
      }
    }
  }
`;

const SUBMIT_EVALUATION = gql`
  mutation SubmitEvaluation($input: CreateEvaluationInput!) {
    submitEvaluation(input: $input) {
      id
      formId
      teacherId
      createdAt
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
  groups?: Array<{
    id: string;
    name: string;
  }>;
  teacher?: {
    id: string;
    fullName: string;
  };
  questions?: Question[];
  userResponded?: boolean;
  userRespondedToForm?: boolean;
}

export interface Question {
  id: string;
  label: string;
  type: 'RATING' | 'TEXT';
  required: boolean;
}

export interface EvaluationAnswer {
  questionId: string;
  rating?: number;
  text?: string;
}

export interface SubmitEvaluationInput {
  formId: string;
  teacherId: string;
  answers: EvaluationAnswer[];
}

interface FormsResponse {
  forms: { edges: { node: EvaluationForm }[] };
}

interface MeGroupsResponse {
  me?: {
    id: string;
    groups: Array<{
      id: string;
    }>;
  } | null;
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

  getActiveForms(): Observable<EvaluationForm[]> {
    return this.apollo.query<FormsResponse>({
      query: GET_FORMS_AND_TEACHERS,
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => {
        const forms = result.data?.forms?.edges.map(e => e.node) || [];
        // Use the userRespondedToForm field from the backend
        return forms.map(form => ({
          ...form,
          userResponded: form.userRespondedToForm || false
        }));
      }),
      catchError(() => of([]))
    );
  }

  getActiveFormsForStudent(): Observable<EvaluationForm[]> {
    const forms$ = this.getActiveForms();
    const groups$ = this.apollo.query<MeGroupsResponse>({
      query: GET_MY_GROUPS,
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => result.data?.me?.groups || []),
      catchError(() => of([]))
    );

    return forkJoin([forms$, groups$]).pipe(
      map(([forms, groups]) => {
        const groupIds = new Set(groups.map(group => group.id));
        if (groupIds.size === 0) {
          return [];
        }
        return forms.filter(form => {
          const formGroupIds = form.groups?.map(group => group.id) || [];
          return formGroupIds.some(groupId => groupIds.has(groupId));
        });
      }),
      catchError(() => of([]))
    );
  }

  private buildEvaluationsUI(evaluations: any[], formMap: Record<string, string>): TeacherEvaluationUI[] {
    return evaluations.map((ev: any) => {
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
  }

  getAllEvaluationsForDebug(): Observable<TeacherEvaluationUI[]> {
    const evaluations$ = this.apollo.query<any>({
      query: GET_ALL_EVALUATIONS_DEBUG,
      fetchPolicy: 'network-only'
    });

    const forms$ = this.apollo.query<any>({
      query: GET_ALL_FORM_TITLES,
      fetchPolicy: 'cache-first'
    });

    return forkJoin([evaluations$, forms$]).pipe(
      map(([evalsResult, formsResult]) => {
        const formMap: Record<string, string> = {};
        formsResult.data.forms.edges.forEach((edge: any) => {
          formMap[edge.node.id] = edge.node.title;
        });
        const rawEvaluations = evalsResult.data.evaluations.edges.map((e: any) => e.node);
        return this.buildEvaluationsUI(rawEvaluations, formMap);
      })
    );
  }

  getEvaluationsForTeacher(teacherId: string): Observable<TeacherEvaluationUI[]> {
    const evaluations$ = this.apollo.query<any>({
      query: GET_TEACHER_EVALUATIONS,
      variables: { teacherId },
      fetchPolicy: 'network-only'
    });

    const forms$ = this.apollo.query<any>({
      query: GET_ALL_FORM_TITLES,
      fetchPolicy: 'cache-first'
    });

    return forkJoin([evaluations$, forms$]).pipe(
      map(([evalsResult, formsResult]) => {
        const formMap: Record<string, string> = {};
        formsResult.data.forms.edges.forEach((edge: any) => {
          formMap[edge.node.id] = edge.node.title;
        });
        const rawEvaluations = evalsResult.data.evaluations.edges.map((e: any) => e.node);
        return this.buildEvaluationsUI(rawEvaluations, formMap);
      })
    );
  }

  private isDateOlderThanToday(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate.getTime() < today.getTime();
  }

  getDashboardMetrics(): Observable<DashboardMetrics> {
    return this.apollo.query<any>({
      query: GET_GLOBAL_STATS,
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => {
        const students = result.data?.students?.edges || [];
        const evaluations = result.data?.evaluations?.edges.map((e: any) => e.node) || [];

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const newFeedbackCount = evaluations.filter((ev: any) =>
          new Date(ev.createdAt) >= oneWeekAgo
        ).length;

        let completionRate = evaluations.length; 

        return { completionRate, newFeedbackCount };
      })
    );
  }

  getFormById(id: string): Observable<EvaluationForm> {
    return this.apollo.query<{ form: EvaluationForm }>({
      query: GET_FORM_BY_ID,
      variables: { id },
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => result.data?.form!)
    );
  }

  submitEvaluation(input: SubmitEvaluationInput): Observable<any> {
    return this.apollo.mutate<{ submitEvaluation: any }>({
      mutation: SUBMIT_EVALUATION,
      variables: { input }
    }).pipe(
      map(result => {
        if (result.error) {
          throw result.error;
        }
        return result.data?.submitEvaluation;
      })
    );
  }
}
