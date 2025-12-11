import { Injectable, inject, signal } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { clear } from 'node:console';
import { tap, catchError, of, map } from 'rxjs';

// Définition de la requête GraphQL
const GET_ME = gql`
  query ExampleQuery {
    me {
      fullName
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

interface UserProfile {
  fullName: string;
}

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
}