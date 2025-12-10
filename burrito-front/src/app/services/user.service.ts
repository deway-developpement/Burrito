import { Injectable, inject, signal } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { tap, catchError, of, map } from 'rxjs';

// Définition de la requête GraphQL
const GET_ME = gql`
  query ExampleQuery {
    me {
      fullName
    }
  }
`;

interface UserProfile {
  fullName: string;
}

interface MeResponse {
  me: UserProfile;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apollo = inject(Apollo);

  // Variable en mémoire (Signal) pour stocker l'utilisateur courant
  currentUser = signal<UserProfile | null>(null);

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
        return of(null);
      })
    );
  }
  
  // Nettoyage simple de la variable en mémoire
  clearUserData() {
    this.currentUser.set(null);
  }
}