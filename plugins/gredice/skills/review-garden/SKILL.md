---
name: review-garden
description: Review an authenticated Gredice garden, raised beds, field lifecycle state, operations, and saved AI history without changing data. Use when a user asks what is planted, what happened, what is scheduled, what needs attention, or for read-only next-step recommendations for their garden.
---

# Review Garden

Build a read-only garden review from authenticated Gredice data and clearly
separate recorded state from recommendations.

## Workflow

1. Call `gardens/list-gardens`. If more than one garden could match, show a
   short choice and wait rather than guessing.
2. Call `gardens/list-raised-beds` for the selected garden. Use identifiers
   returned by Gredice; never ask the user to supply internal account IDs.
3. Use `gardens/get-raised-bed-fields` for relevant beds and
   `gardens/get-lifecycle-context` for active plant state.
4. Use `gardens/list-operations` when the user asks about scheduled, completed,
   overdue, or next work. Keep scheduled and completed operations distinct.
5. Use `gardens/get-raised-bed-ai-history` only when prior saved suggestions
   are relevant; label them as earlier suggestions, not current garden facts.
6. Summarize observations, priorities, and uncertainties. Include the garden
   and bed names that support each recommendation.

## Guardrails

- Keep this workflow read-only. Do not call commerce mutation tools.
- Do not infer a missing plant, lifecycle stage, completion, or operation date.
- If authentication is unavailable, ask the user to connect Gredice through
  the host's authorization flow. Never ask for a token, user ID, or account ID.
- Treat missing or inaccessible gardens as not found. Do not probe whether an
  identifier belongs to another user.
- Do not claim a recommendation was saved or an operation was changed unless
  a separate explicit workflow and server-confirmed write perform that action.
