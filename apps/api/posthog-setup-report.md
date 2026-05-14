<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog into the Gredice API app. Server-side event tracking was added across all critical business flows using `posthog-node`, client-side PostHog was initialized in `instrumentation-client.ts` using `posthog-js`, and a reverse proxy was configured in `next.config.ts` to route PostHog requests through `/ingest`. A shared server client singleton was created at `lib/posthog-server.ts`.

| Event | Description | File |
|---|---|---|
| `user_signed_up` | A new user registers with email/password or via OAuth | `app/api/[...route]/authRoutes.ts` |
| `user_logged_in` | A user logs in successfully (password, Google, or Facebook) | `app/api/[...route]/authRoutes.ts` |
| `user_oauth_logged_in` | — (merged with `user_logged_in`; provider tracked as property) | `app/api/[...route]/authRoutes.ts` |
| `user_logged_out` | A user logs out and their session is revoked | `app/api/[...route]/authRoutes.ts` |
| `user_email_verified` | A user successfully verifies their email address | `app/api/[...route]/authRoutes.ts` |
| `checkout_initiated` | A user begins checkout (Stripe session created or direct payment) | `app/api/[...route]/checkoutRoutes.ts` |
| `checkout_cancelled` | A user cancels an active Stripe checkout session | `app/api/[...route]/checkoutRoutes.ts` |
| `purchase_completed` | A Stripe payment completes and cart items are fully processed | `lib/stripe/processCheckoutSession.ts` |
| `cart_item_updated` | A user adds, updates, or removes an item from their shopping cart | `app/api/[...route]/shoppingCartRoutes.ts` |
| `feedback_submitted` | A user submits feedback with a topic and optional score | `app/api/[...route]/feedbackRoutes.ts` |
| `newsletter_subscribed` | A user subscribes to the Gredice newsletter | `app/api/[...route]/newsletterRoutes.ts` |
| `delivery_address_created` | A user creates a new delivery address | `app/api/[...route]/deliveryRoutes.ts` |
| `delivery_request_cancelled` | A user cancels a delivery request | `app/api/[...route]/deliveryRoutes.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard**: [Analytics basics](https://eu.posthog.com/project/156787/dashboard/614356)
- **Insight**: [New User Sign-ups (Daily)](https://eu.posthog.com/project/156787/insights/peaDHxMN)
- **Insight**: [Logins by Provider](https://eu.posthog.com/project/156787/insights/BI1MQXS4)
- **Insight**: [Checkout to Purchase Conversion](https://eu.posthog.com/project/156787/insights/fP0PU8Zp)
- **Insight**: [Newsletter Subscriptions (Weekly)](https://eu.posthog.com/project/156787/insights/04K7kToK)
- **Insight**: [Full Acquisition & Purchase Funnel](https://eu.posthog.com/project/156787/insights/mioOmtWK)

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
