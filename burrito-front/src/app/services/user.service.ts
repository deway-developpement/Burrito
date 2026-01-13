import { Injectable, inject, signal } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { tap, catchError, of, map, Observable,switchMap, throwError  } from 'rxjs';
import { AuthService } from './auth.service';

// --- QUERIES ---

const CHECK_EMAIL_EXISTS = gql`
  query CheckEmail($email: String!) {
    users(filter: { email: { eq: $email } }) {
      edges {
        node {
          id
        }
      }
    }
  }
`;

const GET_ME = gql`
  query ExampleQuery {
    me {
      id
      fullName
      email
      emailVerified
      userType
      groups {
        id
        name
      }
    }
  }
`;

const GET_TEACHERS = gql`
  query GetTeachers {
    users(
      filter: { userType: { eq: TEACHER } }
      sorting: [{ field: fullName, direction: ASC }]
      paging: { first: 50 }
    ) {
      edges {
        node {
          id
          fullName
          email
          createdAt
          userType
          # FETCHING GROUP DATA
          groups {
            id
            name
          }
        }
      }
    }
  }
`;

const GET_TEACHERS_PAGE = gql`
  query GetTeachersPage($limit: Int, $after: ConnectionCursor) {
    users(
      filter: { userType: { eq: TEACHER } }
      sorting: [{ field: fullName, direction: ASC }]
      paging: { first: $limit, after: $after }
    ) {
      edges {
        cursor
        node {
          id
          fullName
          email
          createdAt
          userType
          groups {
            id
            name
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const GET_STUDENTS = gql`
  query GetStudents {
    users(
      filter: { userType: { eq: STUDENT } }
      sorting: [{ field: fullName, direction: ASC }]
      paging: { first: 50 }
    ) {
      edges {
        node {
          id
          fullName
          email
          createdAt
          userType
          # FETCHING GROUP DATA
          groups {
            id
            name
          }
        }
      }
    }
  }
`;

const GET_STUDENTS_PAGE = gql`
  query GetStudentsPage($limit: Int, $after: ConnectionCursor) {
    users(
      filter: { userType: { eq: STUDENT } }
      sorting: [{ field: fullName, direction: ASC }]
      paging: { first: $limit, after: $after }
    ) {
      edges {
        cursor
        node {
          id
          fullName
          email
          createdAt
          userType
          groups {
            id
            name
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// --- MUTATIONS ---

const UPDATE_USER = gql`
  mutation UpdateOneUser($input: UpdateOneUserInput!) {
    updateOneUser(input: $input) {
      id
      fullName
      email
    }
  }
`;

const CREATE_ONE_USER = gql`
  mutation CreateOneUser($input: CreateOneUserInput!) {
    createOneUser(input: $input) {
      id
    }
  }
`;

const DELETE_USER = gql`
  mutation DeleteOneUser($input: DeleteOneUserInput!) {
    deleteOneUser(input: $input) {
      id
    }
  }
`;

const RESEND_EMAIL_VERIFICATION = gql`
  mutation ResendEmailVerification {
    resendEmailVerification {
      id
      email
      emailVerified
    }
  }
`;

// --- INTERFACES ---

export interface CreateUserPayload {
  email: string;
  fullName: string;
  password: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email?: string;
  emailVerified?: boolean;
  userType: UserType;
  createdAt?: string;
  // ADDED GROUPS INTERFACE HERE
  groups?: {
    id: string;
    name: string;
  }[];
}

export type UserType = 'STUDENT' | 'TEACHER' | 'ADMIN';

interface MeResponse {
  me: UserProfile;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly apollo = inject(Apollo);
  private readonly authService = inject(AuthService);
  currentUser = signal<UserProfile | null>(null);

  getCurrentUser() {
    return this.currentUser();
  }

  fetchMe() {
    return this.apollo.query<MeResponse>({
      query: GET_ME,
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => result.data?.me),
      tap(user => {
        if (user) {
          this.currentUser.set(user);
          this.authService.setCurrentUser(user as any);
        }
      }),
      catchError(error => {
        console.error('FetchMe Error:', error);
        this.currentUser.set(null);
        this.authService.setCurrentUser(null);
        return of(null);
      })
    );
  }

  getTeachers(): Observable<UserProfile[]> {
    return this.apollo.watchQuery<any>({
      query: GET_TEACHERS,
      fetchPolicy: 'cache-and-network'
    }).valueChanges.pipe(
      map(result => result.data?.users?.edges?.map((e: any) => e.node) || []),
      catchError(error => {
        console.error('Error fetching teachers:', error);
        return of([]); 
      })
    );
  }

  getTeachersPage(limit: number, after?: string | null): Observable<{
    users: UserProfile[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  }> {
    return this.apollo.query<any>({
      query: GET_TEACHERS_PAGE,
      variables: { limit, after: after ?? null },
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => {
        const connection = result.data?.users;
        return {
          users: connection?.edges?.map((e: any) => e.node) || [],
          pageInfo: {
            hasNextPage: connection?.pageInfo?.hasNextPage || false,
            endCursor: connection?.pageInfo?.endCursor || null
          }
        };
      }),
      catchError(error => {
        console.error('Error fetching teachers page:', error);
        return of({ users: [], pageInfo: { hasNextPage: false, endCursor: null } });
      })
    );
  }

  getStudents(): Observable<UserProfile[]> {
    return this.apollo.watchQuery<any>({
      query: GET_STUDENTS,
      fetchPolicy: 'cache-and-network'
    }).valueChanges.pipe(
      map(result => result.data?.users?.edges?.map((e: any) => e.node) || []),
      catchError(error => {
        console.error('Error fetching students:', error);
        return of([]); 
      })
    );
  }

    checkEmailExists(email: string): Observable<boolean> {
      return this.apollo.query<any>({
        query: CHECK_EMAIL_EXISTS,
        variables: { email },
        fetchPolicy: 'network-only' // We want fresh data from the DB
      }).pipe(
        map(result => {
          const users = result.data?.users?.edges || [];
          return users.length > 0;
        })
      );
    }


  getStudentsPage(limit: number, after?: string | null): Observable<{
    users: UserProfile[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  }> {
    return this.apollo.query<any>({
      query: GET_STUDENTS_PAGE,
      variables: { limit, after: after ?? null },
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => {
        const connection = result.data?.users;
        return {
          users: connection?.edges?.map((e: any) => e.node) || [],
          pageInfo: {
            hasNextPage: connection?.pageInfo?.hasNextPage || false,
            endCursor: connection?.pageInfo?.endCursor || null
          }
        };
      }),
      catchError(error => {
        console.error('Error fetching students page:', error);
        return of({ users: [], pageInfo: { hasNextPage: false, endCursor: null } });
      })
    );
  }

      createUser(payload: CreateUserPayload, type: UserType) {
      // 1. First, check if the email exists
      return this.checkEmailExists(payload.email).pipe(
        switchMap(exists => {
          if (exists) {
            // 2. If it exists, manually throw an error before calling mutation
            return throwError(() => new Error('A user with this email already exists.'));
          }

          // 3. If it doesn't exist, proceed with the actual mutation
          return this.apollo.mutate({
            mutation: CREATE_ONE_USER,
            variables: {
              input: {
                user: {
                  ...payload,
                  userType: type
                }
              }
            }
          });
        }),
        catchError(err => {
          // Log it and re-throw the message for the toast
          console.error('CreateUser Guard:', err.message);
          return throwError(() => err);
        })
      );
    }
  

  
  // --- FIXED UPDATE FUNCTION ---
  updateUser(id: string, data: { fullName: string; email: string }) {
    return this.apollo.mutate({
      mutation: UPDATE_USER,
      variables: {
        input: {
          id: id,
          update: {
            fullName: data.fullName,
            email: data.email
          }
        }
      }
    }).pipe(
      catchError(error => {
        console.error('Update failed', error);
        throw error;
      })
    );
  }

  deleteUser(id: string) {
    return this.apollo.mutate({
      mutation: DELETE_USER,
      variables: {
        input: {
          id: id
        }
      },
      update: (cache) => {
        const normalizedId = cache.identify({ id, __typename: 'User' });
        if (normalizedId) {
          cache.evict({ id: normalizedId });
          cache.gc();
        }
      }
    }).pipe(
      catchError(error => {
        console.error('Delete failed', error);
        throw error;
      })
    );
  }

  resendEmailVerification() {
    return this.apollo.mutate<{ resendEmailVerification: { id: string; email: string; emailVerified: boolean } }>({
      mutation: RESEND_EMAIL_VERIFICATION,
      fetchPolicy: 'no-cache'
    }).pipe(
      tap((result) => {
        const data = result.data?.resendEmailVerification;
        if (data) {
          const current = this.currentUser();
          this.currentUser.set(current ? { ...current, email: data.email, emailVerified: data.emailVerified } : current);
        }
      }),
      catchError(error => {
        console.error('Resend verification failed', error);
        throw error;
      })
    );
  }

  clearUserData() {
    this.currentUser.set(null);
  }
}
