# Group Membership Plan (Teachers/Students x Groups)

## Goal
Provide a scalable, microservice-friendly many-to-many link between Teachers/Students and Groups, with efficient queries for:
- all groups for a student/teacher
- all members (teachers/students) for a group
- GraphQL hydration of User -> Groups and Group -> Members

## Gateway Context (Current)
- NestJS code-first GraphQL with `@nestjs/graphql` + `@nestjs/apollo`, `autoSchemaFile` -> `schema.gql`
- Domain modules use `NestjsQueryGraphQLModule.forFeature` with `DTOClass`/`CreateDTOClass`/`UpdateDTOClass`
- Each gateway service is a `QueryService` proxy that uses `ClientProxy` + Redis transport
- Service methods follow `*.query`, `*.findById`, `*.aggregate`, `*.count`, `*.createOne`, etc.
- Requests are wrapped with `MICROSERVICE_TIMEOUT_MS` + `GatewayTimeoutException`
- Resolvers extend `CRUDResolver` and use guards (`GqlAuthGuard`, `GqlCredentialGuard`)
- `TimestampToDateInterceptor` normalizes date strings for fields like `createdAt`/`updatedAt`

## Core Design
### Source of truth
Groups service (groups-ms) owns groups + memberships.
- Collections: groups, memberships
- Single source of truth for links and membership metadata

### Service boundaries (combined)
- User service: owns teachers/students
- Groups service (groups-ms): owns groups + memberships
- GraphQL gateway/BFF: composes data across services

## Data Model
Group document:
- _id
- name
- description (optional)
- createdAt
- updatedAt

Indexes:
- optional unique: name (only if you want global uniqueness)

Membership document:
- _id
- groupId (string/ObjectId as string)
- memberId (string/ObjectId as string)

Indexes:
- unique: groupId + memberId
- lookup: memberId
- lookup: groupId

## GraphQL Composition Strategy
### Do not rely on automatic cross-service relations
Use explicit field resolvers in the GraphQL gateway/BFF.

### Resolver patterns
User.groups:
- membershipSvc.listByMember(user.id)
- groupSvc.batchGet(groupIds)

Group.members:
- membershipSvc.listByGroup(group.id)
- userSvc.batchGet(memberIds)

### Performance
- Use DataLoader in the gateway to batch and cache service calls
- Avoid N+1 by batching group and user lookups

## Nest-Query Guidance (Tailored)
- Keep `CRUDResolver` for Group CRUD, like `User`, `Form`, `Evaluation`
- Do not expose `Membership` as a GraphQL type; use custom mutations instead
- Use explicit `@ResolveField` methods for `User.groups` and `Group.members`
- Add DataLoader providers (not currently present in gateway) for batches

## Gateway Integration (Tailored)
### New module layout (api-gateway)
- `apps/api-gateway/src/group/`
  - `group.module.ts` (NestjsQueryGraphQLModule + ClientsModule/Redis)
  - `group.service.ts` (`QueryService` proxy to groups-ms)
  - `group.resolver.ts` (`CRUDResolver` + `@ResolveField` + membership mutations)
  - `dto/group.dto.ts`
  - `dto/create-group.input.ts`
  - `dto/update-group.input.ts`
- `apps/api-gateway/src/membership/`
  - `membership.module.ts` (ClientsModule/Redis; providers only)
  - `membership.service.ts` (RPC client wrapper to groups-ms)
  - `dto/` inputs for mutations (optional)

### Microservice message patterns
Align with existing pattern:
- `group.query`, `group.findById`, `group.aggregate`, `group.count`
- `group.createOne`, `group.createMany`, `group.updateOne`, `group.updateMany`
- `group.deleteOne`, `group.deleteMany`
- `membership.query`, `membership.findById`, `membership.aggregate`, `membership.count`
- `membership.createOne`, `membership.createMany`, `membership.updateOne`, `membership.updateMany`
- `membership.deleteOne`, `membership.deleteMany`
- Optional: `membership.listByGroup`, `membership.listByMember` for optimized lookups

### Field resolvers (gateway)
- `UserResolver`:
  - `@ResolveField(() => [GroupDto]) groups(@Parent() user)`
  - Use membership service -> group service batching
- `GroupResolver`:
  - `@ResolveField(() => [UserDto]) members(@Parent() group)`
  - Use membership service -> user service batching
- Membership mutations (no Membership type in schema):
  - `addUserToGroup`, `removeUserFromGroup` (optionally `setGroupMembers`)
  - Call membership RPCs directly via `MembershipService`
- Apply guards consistent with current patterns (`GqlAuthGuard`, `GqlCredentialGuard`)

## API Sketch
### Groups microservice (Redis RPC)
Single service owns `groups` and `memberships` collections.

Group commands:
- `group.query`, `group.findById`, `group.aggregate`, `group.count`
- `group.createOne`, `group.createMany`, `group.updateOne`, `group.updateMany`
- `group.deleteOne`, `group.deleteMany`

Membership commands:
- `membership.query`, `membership.findById`, `membership.aggregate`, `membership.count`
- `membership.createOne`, `membership.createMany`, `membership.updateOne`, `membership.updateMany`
- `membership.deleteOne`, `membership.deleteMany`
- Optional fast paths: `membership.listByGroup`, `membership.listByMember`

### API gateway GraphQL (nestjs-query + custom mutations)
Expose Group via `NestjsQueryGraphQLModule` + `CRUDResolver`, just like other domains.
- Queries/mutations are generated by nestjs-query for Group only
- Use `@ResolveField` for cross-service hydration (User.groups, Group.members)
- Add explicit membership mutations that call membership RPCs

GraphQL types (gateway):
- `Group` (DTO)
- `CreateGroupInput`
- `UpdateGroupInput`
- Optional inputs: `AddUserToGroupInput`, `RemoveUserFromGroupInput`

Mutation examples (gateway):
- `addUserToGroup(input: AddUserToGroupInput): Group`
- `removeUserFromGroup(input: RemoveUserFromGroupInput): Group`

Group DTO fields:
- id, name, description?, createdAt, updatedAt

## Events (Optional)
Publish events on membership changes:
- MembershipAdded
- MembershipRemoved
Consumers can build read models or materialized views as needed.

## Read Model (Optional for scale)
If queries are extremely hot:
- Build denormalized read models (e.g., group_members_read)
- Keep Membership service as source of truth
- Update read model via events

## Implementation Steps
1) Create groups + memberships schemas + indexes in groups-ms
2) Add group + membership CRUD handlers (Redis transport)
3) Add group module (CRUDResolver) + membership RPC service + membership mutations in api-gateway
4) Implement gateway field resolvers with DataLoader
5) Add membership events (optional)
6) Add read model if needed for performance

## Risks / Notes
- Avoid duplicating membership data across services as source of truth
- Keep IDs consistent across services (stringified ObjectId recommended)
- Membership is hidden from schema; guard the membership mutations and field resolvers
- No Group module exists in the current api-gateway; add it before wiring `Group.members`

## Open Questions
- Should membership ever store extra metadata (roles, status, timestamps)?
