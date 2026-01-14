import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection, inject, provideAppInitializer, PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common'; 

import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { InMemoryCache, ApolloLink, split } from '@apollo/client/core';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { firstValueFrom, of, timeout, catchError, switchMap } from 'rxjs'; 

import { routes } from './app.routes';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';
import { getApiBaseUrl } from './config/runtime-config';

function apolloOptionsFactory() {
    const httpLink = inject(HttpLink);
    const authService = inject(AuthService);
    const platformId = inject(PLATFORM_ID);
    const apiBaseUrl = getApiBaseUrl();
    const http = httpLink.create({
        uri: `${apiBaseUrl}/graphQL`,
        withCredentials: true
    });
    const authLink = new ApolloLink((operation, forward) => {
        const token = authService.token();
        if (token) {
            operation.setContext(({ headers = {} }: { headers?: Record<string, string> }) => ({
                headers: new HttpHeaders(headers).set('Authorization', `Bearer ${token}`)
            }));
        }
        return forward(operation);
    });
    const httpWithAuth = ApolloLink.from([authLink, http]);

    if (!isPlatformBrowser(platformId)) {
        return { link: httpWithAuth, cache: new InMemoryCache() };
    }

    const wsBaseUrl = apiBaseUrl.replace(/^http/, 'ws');
    const wsLink = new GraphQLWsLink(
        createClient({
            url: `${wsBaseUrl}/graphQL`,
            connectionParams: () => {
                const token = authService.token();
                return token ? { Authorization: `Bearer ${token}` } : {};
            }
        })
    );

    const link = split(
        ({ query }) => {
            const definition = getMainDefinition(query);
            return (
                definition.kind === 'OperationDefinition' &&
                definition.operation === 'subscription'
            );
        },
        wsLink,
        httpWithAuth
    );

    return { link, cache: new InMemoryCache() };
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
