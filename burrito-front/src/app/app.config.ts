import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection, inject, provideAppInitializer, PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common'; 

import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { InMemoryCache, ApolloLink } from '@apollo/client/core';
import { firstValueFrom, of, timeout, catchError, switchMap } from 'rxjs'; 

import { routes } from './app.routes';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';

function apolloOptionsFactory() {
    const httpLink = inject(HttpLink);
    const authService = inject(AuthService);
    const http = httpLink.create({ uri: '/graphQL', withCredentials: true });
    const authLink = new ApolloLink((operation, forward) => {
        const token = authService.token();
        if (token) {
            operation.setContext(({ headers }: any = {}) => ({
                headers: new HttpHeaders(headers).set('Authorization', `Bearer ${token}`)
            }));
        }
        return forward(operation);
    });
    return { link: ApolloLink.from([authLink, http]), cache: new InMemoryCache() };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch()),

    provideAppInitializer(() => {
      const authService = inject(AuthService);
      const userService = inject(UserService); // ✅ Injection du UserService
      const platformId = inject(PLATFORM_ID);

      if (!isPlatformBrowser(platformId)) {
        return Promise.resolve();
      }

      return firstValueFrom(
        authService.refreshSession().pipe(
          timeout(3000), 
          
          // ✅ LOGIQUE AJOUTÉE ICI
          switchMap((authResponse) => {
            // Si authResponse est null (refresh échoué ou pas de token), on arrête là.
            if (!authResponse) {
                return of(null);
            }
            
            // Si le refresh est OK, le token est dans le signal.
            // On lance maintenant la récupération du profil utilisateur.
            return userService.fetchMe();
          }),
          // -----------------------

          catchError((err) => {
            console.warn('App Init: Auth or FetchMe failed:', err);
            return of(null);
          })
        )
      );
    }),

    provideApollo(apolloOptionsFactory)
  ]
};