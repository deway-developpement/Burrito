import { Injectable, inject, signal } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { tap, catchError, of, map, Observable } from 'rxjs';
import { AuthService } from './auth.service';

// --- QUERIES ---

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

interface RegisterResponse {
  createOneUser: {
    id: string
  };
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apollo = inject(Apollo);
  private authService = inject(AuthService);
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
  
  register(payload: CreateUserPayload) {
    return this.apollo.mutate<RegisterResponse>({
      mutation: CREATE_ONE_USER,
      variables: {
        input: {
          user: {
            ...payload,
            userType: 'STUDENT'
          }
        }
      }
    });
  }

  createUser(payload: CreateUserPayload, type: UserType) {
    return this.apollo.mutate<RegisterResponse>({
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
  }

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