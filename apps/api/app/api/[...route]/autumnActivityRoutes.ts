import { autumnActivityActionBodySchema } from '@gredice/storage/autumnActivityContract';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { authSecurity } from '../../../lib/docs/security';
import { autumnActivityService } from '../../../lib/garden/autumnActivityService';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';

const defaults = { authValidator, service: autumnActivityService };
export function createAutumnActivityRoutes(
    dependencies: typeof defaults = defaults,
) {
    return new Hono<{ Variables: AuthVariables }>()
        .use('*', async (context, next) => {
            context.header('Cache-Control', 'private, no-store');
            await next();
        })
        .get(
            '/',
            describeRoute({
                description:
                    'Get the authenticated account’s finite autumn album rules, exact zero-value keepsakes and private saved progress. Never grants rewards; closed or withdrawn campaigns retain saved snapshots and ownership links.',
                tags: ['Autumn activity'],
                security: authSecurity,
                responses: {
                    200: {
                        description:
                            'Authoritative window/readiness and private state, including disabled result.',
                    },
                    401: { description: 'Authentication required.' },
                },
            }),
            dependencies.authValidator(['user', 'admin']),
            async (context) =>
                context.json(
                    await dependencies.service.getState(
                        context.get('authContext').accountId,
                    ),
                ),
        )
        .post(
            '/actions',
            describeRoute({
                description:
                    'Acknowledge a server-defined album motif or claim the one-time welcome decoration. The final distinct motif atomically grants one completion keepsake. No physical-discovery proof, purchase, currency, debit, streak or crop action. Exact account-scoped UUID command replays before availability checks; changed command conflicts.',
                tags: ['Autumn activity'],
                security: authSecurity,
                responses: {
                    200: {
                        description:
                            'Durable action receipt or exact replay; zero charge.',
                    },
                    400: { description: 'Invalid command or unknown motif.' },
                    401: { description: 'Authentication required.' },
                    404: { description: 'Account not found.' },
                    409: {
                        description:
                            'Changed account, stale definition, closed window, operation conflict or account deletion.',
                    },
                    503: {
                        description:
                            'Campaign disabled/not ready or retryable atomic failure.',
                    },
                },
            }),
            dependencies.authValidator(['user', 'admin']),
            zValidator('json', autumnActivityActionBodySchema),
            async (context) => {
                const accountId = context.get('authContext').accountId;
                const command = context.req.valid('json');
                if (command.expectedAccountId !== accountId)
                    return context.json(
                        {
                            code: 'EXPECTED_ACCOUNT_MISMATCH',
                            error: 'Račun se promijenio. Vrati se na račun za ovaj zahtjev.',
                        },
                        409,
                    );
                const result = await dependencies.service.act(
                    accountId,
                    command,
                );
                return result.ok
                    ? context.json(result.response)
                    : context.json(
                          { code: result.code, error: result.error },
                          result.status,
                      );
            },
        );
}
export default createAutumnActivityRoutes();
