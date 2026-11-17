# Completion note suggestions

Admins can request a Croatian language edit while reviewing a completed operation in the schedule (bed and farm sections) or operation details. These surfaces share `OperationCompletionEvidenceEditModal` and `OperationCompletionNotesEditor`.

Opening the editor automatically requests a suggestion for a nonempty farmer note that has not been edited. A manual request uses the current draft. Applying a suggestion changes only the draft; saving uses the existing admin evidence-update action and version guard. Pending notes become customer-visible through verification. Saving a correction to an already verified note updates the visible text while the existing notes-only edit flow preserves images and verification metadata. Generation never schedules work, saves notes, or sends notifications.

`completionNotesEdited` is derived from completion-evidence events whose text differs from the preceding note. Photo-only changes do not count. The marker survives reverting the text and resets when an operation is rescheduled, alongside the completion evidence. Existing edit history is recognized without a migration.

The admin-only `POST /api/ai/operation-notes` endpoint validates the note (1–2000 characters), operation status and task version. Automatic requests also check the saved edit marker and source text. It rechecks the version after generation and returns 409 for concurrent changes. The client cancels requests when typing or closing the editor and never applies output automatically. Provider failures leave manual editing available.

Generation uses the existing API app AI Gateway configuration and `openai/gpt-6-luna`. The bounded context contains operation names, the garden/bed name, current and historical crops and their lifecycle dates. Account, contact, billing, farmer and photo records are excluded. Context and notes are treated as untrusted data. The prompt preserves observations and completed work, phrases recommendations gently, and forbids invented actions or claims of execution. Output is plain text with paragraphs or simple lists, capped at 2000 characters. Suggestions are transient; accepted text is preserved by the normal note history after saving.

OpenAPI reference: `/api/docs/ai-operation-notes`.
