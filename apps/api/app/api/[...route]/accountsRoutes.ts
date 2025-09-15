import {
    deleteAccountWithDependencies,
    earnSunflowers,
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

const dailyRewards = [5, 10, 15, 20, 25, 50];

function rewardForDay(day: number) {
    return dailyRewards[Math.min(day, dailyRewards.length) - 1] ?? 0;
}

async function getDailyRewardState(accountId: string) {
    const history = await getSunflowersHistory(accountId, 0, 10000);
    const dailyEvents = history
        .filter((e) => e.reason.startsWith('daily'))
        .sort(
            (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
        );

    let lastDay = 0;
    let lastDate: Date | undefined;
    const streak: Array<{ day: number; amount: number; claimedAt: string }> =
        [];

    if (dailyEvents.length > 0) {
        const latest = dailyEvents[0];
        lastDay = Number(latest.reason.split(':')[1] ?? '1');
        lastDate = new Date(latest.createdAt);
        streak.push({
            day: lastDay,
            amount: rewardForDay(lastDay),
            claimedAt: lastDate.toISOString(),
        });

        let expectedDay = lastDay - 1;
        let prevDate = lastDate;
        for (let i = 1; i < dailyEvents.length && expectedDay > 0; i++) {
            const ev = dailyEvents[i];
            const day = Number(ev.reason.split(':')[1] ?? '1');
            const date = new Date(ev.createdAt);
            const diff = prevDate.getTime() - date.getTime();
            if (day === expectedDay && diff <= 1000 * 60 * 60 * 48) {
                streak.push({
                    day,
                    amount: rewardForDay(day),
                    claimedAt: date.toISOString(),
                });
                expectedDay--;
                prevDate = date;
            } else {
                break;
            }
        }
        streak.sort((a, b) => a.day - b.day);
    }

    const now = new Date();
    let currentDay = 1;
    let canClaim = true;

    if (lastDate) {
        const diffMs = now.getTime() - lastDate.getTime();
        if (diffMs < 1000 * 60 * 60 * 24) {
            currentDay = lastDay;
            canClaim = false;
        } else if (diffMs < 1000 * 60 * 60 * 48) {
            currentDay = Math.min(lastDay + 1, 7);
            canClaim = true;
        } else {
            currentDay = 1;
            canClaim = true;
            lastDay = 0;
        }
    }

    const nextDay = Math.min(currentDay + 1, 7);
    const expiresBase = lastDate ?? now;
    const expiresAt = new Date(expiresBase.getTime() + 1000 * 60 * 60 * 48);

    return {
        canClaim,
        current: { day: currentDay, amount: rewardForDay(currentDay) },
        next: { day: nextDay, amount: rewardForDay(nextDay) },
        streak,
        expiresAt: expiresAt.toISOString(),
    };
}

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
    .get(
        '/current/sunflowers/daily',
        describeRoute({
            description: 'Get daily sunflower reward status',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const state = await getDailyRewardState(accountId);
            return context.json(state);
        },
    )
    .post(
        '/current/sunflowers/daily',
        describeRoute({
            description: 'Claim daily sunflower reward',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const state = await getDailyRewardState(accountId);
            if (state.canClaim) {
                await earnSunflowers(
                    accountId,
                    state.current.amount,
                    `daily:${state.current.day}`,
                );
            }
            const newState = await getDailyRewardState(accountId);
            return context.json(newState);
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
