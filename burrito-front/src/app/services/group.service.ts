import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { map, catchError, Observable, throwError } from 'rxjs';

// --- QUERIES ---

const GET_GROUPS = gql`
  query GetGroups($limit: Int, $cursor: ConnectionCursor) {
    groups(
      paging: { first: $limit, after: $cursor }
      sorting: [{ field: name, direction: ASC }]
    ) {
      edges {
        node {
          id
          name
          description
          createdAt
          members {
            id
            fullName
            email
          }
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

// --- MUTATIONS ---

const CREATE_ONE_GROUP = gql`
  mutation CreateOneGroup($input: CreateOneGroupInput!) {
    createOneGroup(input: $input) {
      id
      name
      description
      createdAt
    }
  }
`;

const ADD_USER_TO_GROUP = gql`
  mutation AddUserToGroup($input: AddUserToGroupInput!) {
    addUserToGroup(input: $input) {
      id
      name
      members {
        id
        fullName
      }
    }
  }
`;

const ADD_FORM_TO_GROUP = gql`
  mutation AddFormToGroup($input: AddFormToGroupInput!) {
    addFormToGroup(input: $input) {
      id
      name
    }
  }
`;

// --- NEW MUTATION ADDED HERE ---
const REMOVE_USER_FROM_GROUP = gql`
  mutation RemoveUserFromGroup($input: RemoveUserFromGroupInput!) {
    removeUserFromGroup(input: $input) {
      id
      name
      members {
        id
        fullName
      }
    }
  }
`;

const REMOVE_FORM_FROM_GROUP = gql`
  mutation RemoveFormFromGroup($input: RemoveFormFromGroupInput!) {
    removeFormFromGroup(input: $input) {
      id
      name
    }
  }
`;

// --- INTERFACES ---

export interface GroupProfile {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  members?: {
    id: string;
    fullName: string;
    email: string;
  }[];
}

export interface CreateGroupPayload {
  name: string;
  description?: string;
}

interface GroupResponse {
  createOneGroup: GroupProfile;
}

interface AddUserResponse {
  addUserToGroup: GroupProfile;
}

// Interface for the remove response
interface RemoveUserResponse {
  removeUserFromGroup: GroupProfile;
}

interface AddFormResponse {
  addFormToGroup: GroupProfile;
}

interface RemoveFormResponse {
  removeFormFromGroup: GroupProfile;
}

@Injectable({
  providedIn: 'root'
})
export class GroupService {
  private apollo = inject(Apollo);

  getGroups(limit: number = 50, cursor?: string): Observable<GroupProfile[]> {
    return this.apollo.watchQuery<any>({
      query: GET_GROUPS,
      variables: { limit, cursor },
      fetchPolicy: 'cache-and-network'
    }).valueChanges.pipe(
      map(result => result.data?.groups?.edges?.map((e: any) => e.node) || []),
      catchError(error => {
        console.error('Error fetching groups:', error);
        return throwError(() => error);
      })
    );
  }

  createGroup(payload: CreateGroupPayload): Observable<GroupProfile> {
    return this.apollo.mutate<GroupResponse>({
      mutation: CREATE_ONE_GROUP,
      variables: {
        input: {
          group: {
            name: payload.name,
            description: payload.description
          }
        }
      },
      refetchQueries: [{ 
        query: GET_GROUPS,
        variables: { limit: 50 }
      }]
    }).pipe(
      map(result => {
        if (!result.data) throw new Error('No data returned');
        return result.data.createOneGroup; 
      }),
      catchError(error => {
        console.error('Create Group Error:', error);
        return throwError(() => error);
      })
    );
  }

  addUserToGroup(groupId: string, userId: string): Observable<GroupProfile> {
    return this.apollo.mutate<AddUserResponse>({
      mutation: ADD_USER_TO_GROUP,
      variables: {
        input: {
          groupId: groupId,
          memberId: userId
        }
      }
    }).pipe(
      map(result => {
        if (!result.data) throw new Error('No data returned');
        return result.data.addUserToGroup;
      }),
      catchError(error => {
        console.error('Failed to add user to group', error);
        return throwError(() => error);
      })
    );
  }

  addFormToGroup(payload: { groupId: string; formId: string }): Observable<GroupProfile> {
    return this.apollo.mutate<AddFormResponse>({
      mutation: ADD_FORM_TO_GROUP,
      variables: {
        input: payload
      }
    }).pipe(
      map(result => {
        if (!result.data) throw new Error('No data returned');
        return result.data.addFormToGroup;
      }),
      catchError(error => {
        console.error('Failed to add form to group', error);
        return throwError(() => error);
      })
    );
  }

  // --- NEW METHOD ADDED HERE ---
  removeUserFromGroup(groupId: string, userId: string): Observable<GroupProfile> {
    return this.apollo.mutate<RemoveUserResponse>({
      mutation: REMOVE_USER_FROM_GROUP,
      variables: {
        input: {
          groupId: groupId,
          memberId: userId
        }
      }
    }).pipe(
      map(result => {
        if (!result.data) throw new Error('No data returned');
        return result.data.removeUserFromGroup;
      }),
      catchError(error => {
        console.error('Failed to remove user from group', error);
        return throwError(() => error);
      })
    );
  }

  removeFormFromGroup(payload: { groupId: string; formId: string }): Observable<GroupProfile> {
    return this.apollo.mutate<RemoveFormResponse>({
      mutation: REMOVE_FORM_FROM_GROUP,
      variables: {
        input: payload
      }
    }).pipe(
      map(result => {
        if (!result.data) throw new Error('No data returned');
        return result.data.removeFormFromGroup;
      }),
      catchError(error => {
        console.error('Failed to remove form from group', error);
        return throwError(() => error);
      })
    );
  }
}
