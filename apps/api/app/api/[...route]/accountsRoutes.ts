import {
    deleteAccountWithDependencies,
    getAccount,
    getAccountUsers,
    getSunflowers,
    getSunflowersHistory,
    getUser,
    knownEventTypes,
} from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { verifyJwt } from '../../../lib/auth/auth';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';

const app = new Hono<{ Variables: AuthVariables }>()
    .get(
        '/current',
        describeRoute({
            description: 'Get the current account',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const dbAccount = await getAccount(accountId);
            if (!dbAccount) {
                return context.json(
                    {
                        error: 'Account not found',
                    },
                    404,
                );
            }
            return context.json({
                id: dbAccount?.id,
                createdAt: dbAccount?.createdAt.toISOString(),
                updatedAt: dbAccount?.updatedAt.toISOString(),
            });
        },
    )
    .get(
        '/current/sunflowers',
        describeRoute({
            description: 'Get the current account sunflowers',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const [accountSunflowers, accountSunflowersHistory] =
                await Promise.all([
                    getSunflowers(accountId),
                    getSunflowersHistory(accountId, 0, 1000),
                ]);
            return context.json({
                amount: accountSunflowers,
                history: accountSunflowersHistory.map((event) => ({
                    id: event.id,
                    createdAt: event.createdAt.toISOString(),
                    amount:
                        event.type === knownEventTypes.accounts.spendSunflowers
                            ? -event.amount
                            : event.amount,
                    reason: event.reason,
                })),
            });
        },
    )
    .delete(
        '/',
        describeRoute({
            description: 'Deletes the account.',
        }),
        async (context) => {
            // TODO: Use zod
            const token = context.req.query('token');
            console.info(
                `[AccountDelete] Deleting account with token=${token}`,
            );
            let currentUserId: string | undefined;
            try {
                const { result, error } = await verifyJwt(
                    typeof token === 'string' ? token : '',
                    {
                        expiry: '72h',
                    },
                );
                if (error || !result?.payload.sub) {
                    console.warn('JWT verify returned error:', error);
                    throw new Error('Invalid state token');
                }
                currentUserId = result.payload.sub;
            } catch (error) {
                console.warn('Error verifying JWT:', error);
                return context.json({ error: 'Invalid or expired link.' }, 400);
            }

            try {
                const user = await getUser(currentUserId);
                const accountId = user?.accounts?.at(0)?.accountId;
                if (!accountId) {
                    return context.json({ error: 'Account not found.' }, 404);
                }

                // TODO: Move check to delete function (repo)
                // Check preconditions again
                const users = await getAccountUsers(accountId);
                if (!users || users.length !== 1) {
                    return context.json(
                        { error: 'Account must have exactly one user.' },
                        400,
                    );
                }

                await deleteAccountWithDependencies(accountId, currentUserId);

                return context.json({
                    success: true,
                    message: 'Account deleted successfully.',
                });
            } catch (error) {
                console.error('[AccountDelete] Error deleting account:', error);
                return context.json({ error: 'Invalid or expired link.' }, 500);
            }
        },
    );

export default app;
