import { Injectable, inject, signal } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { tap, catchError, of, map, Observable } from 'rxjs';
import { FormGroup } from '@angular/forms';

// Définition de la requête GraphQL
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
      # CORRECTION ICI : On utilise 'fullName' car 'createdAt' n'est pas supporté
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

const UPDATE_USER = gql`
  mutation UpdateOneUser($input: UpdateOneUserInput!) {
    updateOneUser(input: $input) {
      id
      fullName
      email
    }
  }
`;

const CREATE_STUDENT = gql`
  mutation CreateStudent($createUserInput: CreateUserInput!) {
    createStudent(createUserInput: $createUserInput) {
      id
    }
  }
`;

export interface UserProfile {
  id: string;
  fullName: string;
  email?: string; // Added email as it is useful for the list
  userType: UserType;
  createdAt?: string;
}

type UserType = 'STUDENT' | 'TEACHER' | 'ADMIN';

interface MeResponse {
  me: UserProfile;
}

export interface RegisterPayload {
  email: string;
  fullName: string;
  password: string;
}

interface RegisterResponse {
  createStudent: {
    id: string
  };
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apollo = inject(Apollo);

  // Variable en mémoire (Signal) pour stocker l'utilisateur courant
  currentUser = signal<UserProfile | null>(null);

  getCurrentUser() {
    return this.currentUser();
  }

  fetchMe() {
    return this.apollo.query<MeResponse>({
      query: GET_ME,
      fetchPolicy: 'network-only'
    }).pipe(
      // 1. Extraction sécurisée des données
      map(result => result.data?.me),
      
      tap((user) => {
        if (user) {
          // 2. On log dans la console comme demandé
          console.log('User fetched successfully:', user);
          
          // 3. On stocke uniquement en mémoire (variable signal)
          this.currentUser.set(user);
        }
      }),
      catchError((error) => {
        console.error('Erreur lors du fetchMe', error);
        this.clearUserData();
        return of(null);
      })
    );
  }

  getTeachers(): Observable<UserProfile[]> {
    return this.apollo.watchQuery<any>({
      query: GET_TEACHERS,
      fetchPolicy: 'cache-and-network'
    }).valueChanges.pipe(
      map(result => {
        // Flatten the "edges -> node" structure from GraphQL
        const edges = result.data?.users?.edges || [];
        return edges.map((edge: any) => edge.node) as UserProfile[];
      }),
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
      map(result => {
        const edges = result.data?.users?.edges || [];
        return edges.map((edge: any) => edge.node) as UserProfile[];
      }),
      catchError(error => {
        console.error('Error fetching students:', error);
        return of([]); 
      })
    );
  }
  
  register(payload: RegisterPayload) {
    return this.apollo.mutate<RegisterResponse>({
      mutation: CREATE_STUDENT,
      variables: {
        // Matches the structure required: { "createUserInput": { ... } }
        createUserInput: payload 
      }
    }).pipe(
      tap(result => {
        console.log('Registration successful:', result.data?.createStudent);
      }),
      catchError(error => {
        console.error('Registration failed:', error);
        throw error; // Rethrow so the component can handle the error UI (e.g., "Email already exists")
      })
    );
  }

  // Nettoyage simple de la variable en mémoire
  clearUserData() {
    this.currentUser.set(null);
  }

  updateUser(id: string, data: { fullName: string; email: string }) {
    return this.apollo.mutate({
      mutation: UPDATE_USER,
      variables: {
        input: {
          id: id,
          update: {
            id: id, // The input type in your schema requires ID inside the update object too
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
}