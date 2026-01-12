import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { catchError, map, Observable, of } from 'rxjs';

const GET_GROUPS = gql`
  query GetGroups {
    groups(sorting: [{ field: name, direction: ASC }], paging: { first: 50 }) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

const ADD_FORM_TO_GROUP = gql`
  mutation AddFormToGroup($input: AddFormToGroupInput!) {
    addFormToGroup(input: $input) {
      id
    }
  }
`;

const REMOVE_FORM_FROM_GROUP = gql`
  mutation RemoveFormFromGroup($input: RemoveFormFromGroupInput!) {
    removeFormFromGroup(input: $input) {
      id
    }
  }
`;

export interface GroupSummary {
  id: string;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class GroupService {
  private apollo = inject(Apollo);

  getGroups(): Observable<GroupSummary[]> {
    return this.apollo
      .watchQuery<any>({
        query: GET_GROUPS,
        fetchPolicy: 'cache-and-network',
      })
      .valueChanges.pipe(
        map(
          (result) =>
            result.data?.groups?.edges?.map((edge: any) => edge.node) || [],
        ),
        catchError((error) => {
          console.error('Error fetching groups:', error);
          return of([]);
        }),
      );
  }

  addFormToGroup(payload: { groupId: string; formId: string }) {
    return this.apollo.mutate({
      mutation: ADD_FORM_TO_GROUP,
      variables: {
        input: payload,
      },
    });
  }

  removeFormFromGroup(payload: { groupId: string; formId: string }) {
    return this.apollo.mutate({
      mutation: REMOVE_FORM_FROM_GROUP,
      variables: {
        input: payload,
      },
    });
  }
}
