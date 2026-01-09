import { Injectable, inject, signal } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { tap, catchError, of, map, Observable } from 'rxjs';

// --- QUERIES ---

const GET_ME = gql`
  query ExampleQuery {
    me {
      id
      fullName
      userType
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
  userType: UserType;
  createdAt?: string;
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
          console.log('User fetched:', user);
          this.currentUser.set(user);
        }
      }),
      catchError(error => {
        console.error('FetchMe Error:', error);
        this.currentUser.set(null);
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

  // --- FIXED UPDATE FUNCTION ---
  updateUser(id: string, data: { fullName: string; email: string }) {
    return this.apollo.mutate({
      mutation: UPDATE_USER,
      variables: {
        input: {
          id: id,        // 1. The ID identifies WHICH user to update
          update: {      // 2. The update object contains only the NEW data
            // id: id,   <-- REMOVED: This was causing the error
            fullName: data.fullName,
            email: data.email
          }
        }
      }
    }).pipe(
      tap(() => console.log('User updated successfully')),
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
      tap(() => console.log(`User ${id} deleted successfully`)),
      catchError(error => {
        console.error('Delete failed', error);
        throw error;
      })
    );
  }

  clearUserData() {
    this.currentUser.set(null);
  }
}