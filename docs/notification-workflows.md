# Notification workflows

The platform centralizes administrator-facing notifications through the Slack
integration implemented in `@gredice/notifications`. Notifications are sent
using the bot token provided via `SLACK_BOT_TOKEN`. When a target channel is not
configured, the notification is skipped and the omission is logged for
observability.

## Configuration summary

- **Slack bot token:** `SLACK_BOT_TOKEN`
- **Delivery channel:** `notification_settings.key = 'slack.delivery.channel'`
  (admin UI → Komunikacija → Slack postavke → Dostava)
- **New user channel:** `notification_settings.key = 'slack.new_users.channel'`
  (admin UI → Komunikacija → Slack postavke → Novi korisnici)
- **Shopping channel:** `notification_settings.key = 'slack.shopping.channel'`
  (admin UI → Komunikacija → Slack postavke → Kupnja)
- **Farm specific channel:** per farm in the admin UI → Farma → Slack kanal
  (stored in the `farms.slack_channel_id` column)

## Operations on farms

Events `scheduled`, `rescheduled`, `approved`, `completed` and `canceled` for
field operations trigger a Slack message in the farm's configured channel.
Messages are emitted from:

- Admin actions in `apps/app/app/(actions)/operationActions.ts`
- Checkout automation in `apps/api/lib/stripe/processCheckoutSession.ts`

If a farm does not have a Slack channel configured, the notification is skipped.

## Delivery requests

Delivery requests send Slack messages to the channel stored in
`notification_settings` with key `slack.delivery.channel` for the following
lifecycle changes:

- Creation (user API, checkout automation, admin tools)
- Status transitions (confirmed, preparing, ready, fulfilled)
- Slot changes
- Cancellations (user or admin initiated)

Implementation spans the admin actions in
`apps/app/app/admin/delivery/requests/actions.ts` and the public API routes in
`apps/api/app/api/[...route]/deliveryRoutes.ts` as well as checkout automation in
`apps/api/lib/stripe/processCheckoutSession.ts`.

## User registration

Whenever a new account is created—either through the email/password registration
flow or OAuth providers—a message is sent to the Slack channel configured in
`notification_settings` (`slack.new_users.channel`). This is handled in the
authentication routes inside
`apps/api/app/api/[...route]/authRoutes.ts`.

## Shopping checkout

After a Stripe checkout session is successfully processed, a purchase summary is
posted to the Slack channel configured in
`notification_settings` (`slack.shopping.channel`). The summary includes the total amount,
checkout session identifier, associated account (if available) and a short list
of purchased items. Implementation lives in
`apps/api/lib/stripe/processCheckoutSession.ts`.

## Failure handling

Slack message delivery uses `@gredice/slack`. Any network or API errors are
logged to the console but do not interrupt the primary business flow. Missing
configuration (token or channel) results in a no-op with a debug log so that the
workflow continues without raising exceptions.
