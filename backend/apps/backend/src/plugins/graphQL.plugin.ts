/* eslint-disable @typescript-eslint/require-await */

import { GraphQLRequestListener } from '@apollo/server';
import { ApolloServerPlugin } from '@apollo/server';
import { Plugin } from '@nestjs/apollo';

// This plugin is used to set the HTTP status code to 401 when the user is not authorized so that the client can handle the error
@Plugin()
export class setHttpPlugin implements ApolloServerPlugin {
  async requestDidStart(): Promise<GraphQLRequestListener<any>> {
    return {
      async willSendResponse({ response }) {
        const body = response.body;
        if (body.kind === 'single') {
          const errors = body.singleResult.errors;
          if (errors && errors.length > 0) {
            const unauthorizedError = errors.find(
              (error) =>
                error.extensions?.code === 'UNAUTHENTICATED' ||
                error.extensions?.code === 'UNAUTHORIZED',
            );
            if (unauthorizedError) {
              response.http.status = 401;
            }
          }
        }
      },
    };
  }
}
