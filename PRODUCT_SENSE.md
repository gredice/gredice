# Product Sense Guide

Use this guide when choosing behavior, copy, defaults, and workflow shape.

## Product model

Gredice helps people plan, buy, operate, and understand modular gardens. The platform combines public education and commerce, customer garden management, farm operations, internal administration, notifications, payments, delivery, and game-like garden visualization.

## Users

- Public visitors compare offers, plants, raised beds, blocks, recipes, delivery terms, and company information.
- Customers use the garden experience to understand what is planted, what happens next, and what they purchased.
- Farm operators need clear daily work, schedules, raised-bed context, delivery status, and account/user details.
- Internal admins need reliable directory, inventory, invoice, transaction, communication, and support workflows.
- Developers and collaborators use Storybook and shared packages to keep UI behavior consistent.

## Decision principles

- Preserve domain meaning. Gardens, raised beds, fields, plants, sorts, operations, carts, deliveries, invoices, and accounts are business concepts, not generic records.
- Optimize for the user doing the work, not for implementation convenience.
- Keep money, inventory, delivery, fiscalization, and scheduled operation behavior explicit and auditable.
- Prefer clear state transitions over hidden side effects.
- When a workflow crosses apps or packages, maintain a single source of truth and reuse the shared package contract.
- Match the language and tone already used by the app and route. Public-facing Croatian copy should stay consistent with nearby pages.

## Feature shaping

- Before adding a new UI, identify which app owns the workflow and whether a shared component already exists.
- For public pages, make the primary offer or content clear without requiring the user to decode platform internals.
- For operational tools, make the next action, current status, and data provenance easy to scan.
- For garden/game features, preserve the user's mental model of a real raised bed and the timing of real garden work.
- For notifications and emails, make triggers, recipients, timing, and opt-out/settings behavior explicit.

## Copy and content

- Do not invent facts about plants, delivery, pricing, legal terms, fiscalization, or availability.
- Keep copy close to existing terminology in the app.
- Avoid vague success messages. Confirm the object and state that changed.
- Error messages should explain the problem and the next recoverable action without exposing secrets or internals.
