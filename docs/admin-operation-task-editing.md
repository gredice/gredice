# Admin operation task editing

The operation detail page at `/admin/operations/[operationId]` separates the
catalogue definition (image, description, duration, customer price, farm price,
and customer price minus farm price) from the individual task and its location.
Farm prices prefer the entity-specific price, then the farm's operation default.
Missing prices are shown as unknown; profit is available only when both prices
are in EUR.

The task card's pencil opens an administrator-only editor in every task state,
including verified, blocked, failed, and canceled tasks. It edits the operation
definition, acceptance, assigned farm users, scheduling and lifecycle dates,
customer note, and outcome details. Changing status prefills the corresponding
dates, and returning to new/planned clears completion and verification dates.
Date inputs use the administrator's browser timezone; stored values remain UTC.
Untouched dates retain their original precision.
Accepted tasks require at least one assigned user.

The description card has an icon-only pencil for completion notes and photos.
On this detail page, administrators can edit evidence in every state, including
photos after verification. The schedule's existing restricted evidence editor
keeps its existing behavior.

Task corrections are serialized with normal schedule mutations and recorded as
append-only `operation.admin.update` events. Current administrator authorization,
rendered task version, operation target constraints, and newly assigned users'
farm membership are checked inside the transaction. Historical assignees can
remain after leaving the farm. Original completion and verification event IDs
are retained for date-only corrections. Changing acceptance or status is an
administrative correction; it does not issue refunds or send workflow
notifications. Entering completed still applies the existing selected-planting
verification behavior once. Reclosing a reopened transplant or removal task
recognizes the prior physical effect. Reopening a task does not reverse a
physical planting lifecycle change or a prior payout.

Operation aggregates, list sorting/filtering, completion date reports, schedule
reads, and bed photo projections include the corrected task state. Schedule caches are invalidated after the transaction commits; the admin
pages showing the task are revalidated. A stale save keeps the draft open and
requires reopening the editor with the latest task version.

Validation:

```bash
pnpm --filter @gredice/storage test:node operationTaskAdministrationRepo.node.spec.ts operationsRepo.node.spec.ts scheduleTaskSubmissionsRepo.node.spec.ts
pnpm --filter app exec node --import tsx --test --conditions=react-server app/admin/operations/operationTaskAdminModel.unit.ts
pnpm --filter app exec playwright test OperationTaskAdminEditModal.spec.tsx OperationCompletionEvidenceEditModal.spec.tsx
```
