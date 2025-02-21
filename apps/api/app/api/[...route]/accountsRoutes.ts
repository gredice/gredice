import { Hono } from 'hono';
import { getAccount, getSunflowers, getSunflowersHistory } from '@gredice/storage';
import { describeRoute } from 'hono-openapi';
import { authValidator, AuthVariables } from '../../../lib/hono/authValidator';
import "zod-openapi/extend";
import { knownEventTypes } from '@gredice/storage';

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
                return context.json({
                    error: 'Account not found',
                }, 404);
            }
            return context.json({
                id: dbAccount?.id,
                createdAt: dbAccount?.createdAt.toISOString(),
                updatedAt: dbAccount?.updatedAt.toISOString(),
            });
        })
    .get(
        '/current/sunflowers',
        describeRoute({
            description: 'Get the current account sunflowers',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const [accountSunflowers, accountSunflowersHistory] = await Promise.all([
                getSunflowers(accountId),
                getSunflowersHistory(accountId, 0, 1000)
            ]);
            return context.json({
                amount: accountSunflowers,
                history: accountSunflowersHistory.map((event) => ({
                    id: event.id,
                    createdAt: event.createdAt.toISOString(),
                    amount: event.type === knownEventTypes.accounts.spendSunflowers 
                        ? -event.amount 
                        : event.amount,
                    reason: event.reason
                }))
            });
        });

export default app;