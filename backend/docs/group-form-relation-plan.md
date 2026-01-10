# Group-Form Relation Plan (Groups x Forms)

## Goal
Add a many-to-many link between Groups and Forms, modeled the same way as Group Memberships. The groups service remains the source of truth for the link table, while other services consume it via RPC.

## Scope and constraints
- Store the relation in `groups-ms` only (similar to `membership`).
- Keep forms and groups as separate collections; add a new join collection.
- Do not change `forms-ms` data ownership.
- Expose relation operations through groups-ms RPC commands.

## Data model
### GroupForm document
- `_id`
- `groupId` (string, group ObjectId serialized)
- `formId` (string, form ObjectId serialized)

### Indexes
- Unique compound: `{ groupId: 1, formId: 1 }`
- Lookup: `{ groupId: 1 }`
- Lookup: `{ formId: 1 }`

## groups-ms implementation
### Module layout (mirror membership)
- `apps/groups-ms/src/group-form/entities/group-form.entity.ts`
- `apps/groups-ms/src/group-form/group-form.service.ts`
- `apps/groups-ms/src/group-form/group-form.controller.ts`
- `apps/groups-ms/src/group-form/group-form.module.ts`

### Service behavior
- Extend `MongooseQueryService` like `MembershipService`.
- Add the same duplicate key handling (RPC 409).
- Convenience methods:
  - `listByGroup(groupId)`
  - `listByGroups(groupIds)`
  - `listByForm(formId)`
  - `listByForms(formIds)`
  - `removeByComposite({ groupId, formId })`

### RPC message patterns
Use a parallel naming scheme to membership:
- `groupForm.query`, `groupForm.findById`, `groupForm.aggregate`, `groupForm.count`
- `groupForm.createOne`, `groupForm.createMany`, `groupForm.updateOne`, `groupForm.updateMany`
- `groupForm.deleteOne`, `groupForm.deleteMany`
- `groupForm.listByGroup`, `groupForm.listByGroups`
- `groupForm.listByForm`, `groupForm.listByForms`
- `groupForm.removeByComposite`

### Wiring
- Add `GroupFormModule` to `apps/groups-ms/src/groups-ms.module.ts`.

## Shared types
Add a new interface in `libs/common` (alongside `IMembership`):
- `IGroupForm` with `id`, `groupId`, `formId`
- Export it from `libs/common/src/index.ts`

## Gateway integration (if GraphQL is required)
Mirror the membership pattern (no GraphQL type for the join table).
- Add `GroupFormService` in api-gateway to call groups-ms.
- Add DataLoaders:
  - `groupFormsByGroup`
  - `groupFormsByForm`
- Add field resolvers:
  - `Group.forms` -> groupForm list by group -> fetch Forms
  - `Form.groups` -> groupForm list by form -> fetch Groups
- Add mutations (guarded like group membership):
  - `addFormToGroup`
  - `removeFormFromGroup`

## Testing and validation
- Create/update integration tests for duplicate constraints (groupId + formId).
- Add unit tests for list-by methods.
- Validate GraphQL field resolvers and mutations if gateway changes are added.

## Implementation steps
1) Add `IGroupForm` to `libs/common`.
2) Create group-form entity + schema + indexes in groups-ms.
3) Implement service/controller/module mirroring membership patterns.
4) Wire module into `GroupsMsModule`.
5) (Optional) Add api-gateway service/loaders/resolvers + mutations.
6) Run a quick manual RPC check for list/add/remove flows.

## Open questions
- Do we need metadata on the relation (timestamps, assignedBy, status)?
- Should link removal be idempotent or return 404 like membership?
