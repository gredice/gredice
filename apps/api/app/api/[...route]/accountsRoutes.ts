import { tz } from '@date-fns/tz';
import { sendEmail } from '@gredice/email/acs';
import {
    acceptAccountInvitation,
    accounts as accountRecords,
    cancelAccountInvitation,
    createAccountInvitation,
    createEvent,
    deleteAccountWithDependencies,
    earnSunflowers,
    getAccount,
    getAccountAchievements,
    getAccountGardens,
    getAccountInvitationByToken,
    getAccountInvitations,
    getAccountInvitationsByEmail,
    getAccountUsers,
    getEvents,
    getRaisedBeds,
    getSunflowers,
    getSunflowersHistory,
    getUser,
    knownEventTypes,
    sql,
    storage,
    events as storedEvents,
    updateAccountTimeZone,
} from '@gredice/storage';
import AccountDeleteConfirmationTemplate from '@gredice/transactional/emails/Account/delete-confirmation';
import { addDays, differenceInCalendarDays, startOfDay } from 'date-fns';
import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { setCookie as honoSetCookie } from 'hono/cookie';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import { createJwt, verifyJwt } from '../../../lib/auth/auth';
import {
    accountCookieName,
    cookieDomain,
} from '../../../lib/auth/sessionConfig';
import { authSecurity } from '../../../lib/docs/security';
import { sendAccountInvitation } from '../../../lib/email/transactional';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';
import { getPostHogClient } from '../../../lib/posthog-server';

const dailyRewards = [5, 10, 15, 20, 25, 50];
const DAILY_REWARD_TIME_ZONE = 'Europe/Zagreb';
const GARDEN_APP_URL =
    process.env.GREDICE_GARDEN_APP_URL ?? 'https://vrt.gredice.com';

function rewardForDay(day: number) {
    return dailyRewards[Math.min(day, dailyRewards.length) - 1] ?? 0;
}

function getEmailDomain(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const [, domain] = normalizedEmail.split('@');
    return domain ?? 'unknown';
}

function getReferralLink(code: string) {
    const url = new URL(GARDEN_APP_URL);
    url.searchParams.set('ref', code);
    return url.toString();
}

async function getDailyRewardState(accountId: string) {
    const history = await getSunflowersHistory(accountId, 0, 10000);
    const toLocalTime = tz(DAILY_REWARD_TIME_ZONE);
    const dailyEvents = history
        .filter(
            (e) => typeof e.reason === 'string' && e.reason.startsWith('daily'),
        )
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
        const toLocalDay = (date: Date) => startOfDay(toLocalTime(date));
        const latest = dailyEvents[0];
        const latestReasonPart =
            typeof latest.reason === 'string'
                ? latest.reason.split(':')[1]
                : undefined;
        lastDay = Number(latestReasonPart ?? '1');
        lastDate = new Date(latest.createdAt);
        const latestLocalDay = toLocalDay(lastDate);
        const seenLocalDays = new Set<number>([latestLocalDay.getTime()]);
        streak.push({
            day: lastDay,
            amount: rewardForDay(lastDay),
            claimedAt: lastDate.toISOString(),
        });

        let expectedDay = lastDay - 1;
        let expectedLocalDay = addDays(latestLocalDay, -1);
        for (let i = 1; i < dailyEvents.length && expectedDay > 0; i++) {
            const ev = dailyEvents[i];
            const day = Number(
                (typeof ev.reason === 'string'
                    ? ev.reason.split(':')[1]
                    : undefined) ?? '1',
            );
            const date = new Date(ev.createdAt);
            const eventLocalDay = toLocalDay(date);

            const eventLocalTime = eventLocalDay.getTime();
            if (seenLocalDays.has(eventLocalTime)) {
                continue;
            }

            if (eventLocalTime !== expectedLocalDay.getTime()) {
                break;
            }

            streak.push({
                day,
                amount: rewardForDay(day),
                claimedAt: date.toISOString(),
            });
            seenLocalDays.add(eventLocalTime);
            expectedDay--;
            expectedLocalDay = addDays(expectedLocalDay, -1);
        }
        streak.sort((a, b) => a.day - b.day);
    }

    const now = new Date();
    const nowLocal = toLocalTime(now);
    let currentDay = 1;
    let canClaim = true;

    if (lastDate) {
        const lastLocal = toLocalTime(lastDate);
        const diffDays = differenceInCalendarDays(nowLocal, lastLocal);

        if (diffDays === 0) {
            currentDay = lastDay;
            canClaim = false;
        } else if (diffDays === 1) {
            currentDay = Math.min(lastDay + 1, 7);
            canClaim = true;
        } else {
            currentDay = 1;
            canClaim = true;
            lastDay = 0;
        }
    }

    // When user has reached day 7, ensure all days 1-6 are always marked as claimed
    // This handles the case where user continues claiming day 7 on subsequent days
    if (currentDay >= 7 && lastDay >= 7) {
        // Ensure days 1-6 are in the streak
        for (let day = 1; day <= 6; day++) {
            const existing = streak.find((s) => s.day === day);
            if (!existing) {
                streak.push({
                    day,
                    amount: rewardForDay(day),
                    claimedAt:
                        lastDate?.toISOString() ?? nowLocal.toISOString(),
                });
            }
        }
        streak.sort((a, b) => a.day - b.day);
    }

    const nextDay = Math.min(currentDay + 1, 7);
    const expiresLocalBase = lastDate ? toLocalTime(lastDate) : nowLocal;
    const expiresLocal = addDays(
        startOfDay(expiresLocalBase),
        lastDate ? 2 : 1,
    );
    const expiresAt = new Date(+expiresLocal);

    return {
        canClaim,
        current: { day: currentDay, amount: rewardForDay(currentDay) },
        next: { day: nextDay, amount: rewardForDay(nextDay) },
        streak,
        expiresAt: expiresAt.toISOString(),
    };
}

const REFERRAL_REWARD = 10000;
const REFERRAL_EVENT_TYPE = 'account.referral.v1';

class ReferralCodeAlreadyExistsError extends Error {}

function normalizeReferralCode(code: string) {
    return code
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 32);
}

function codeFromCodeSetEventData(data: unknown) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    if (!('action' in data) || data.action !== 'code_set') {
        return null;
    }
    if (!('code' in data) || typeof data.code !== 'string') {
        return null;
    }
    return normalizeReferralCode(data.code);
}

async function getReferralCodeOwnerAccountId(
    code: string,
    db: Pick<ReturnType<typeof storage>, 'select'>,
) {
    const [accounts, events] = await Promise.all([
        db.select({ id: accountRecords.id }).from(accountRecords),
        db
            .select({
                aggregateId: storedEvents.aggregateId,
                data: storedEvents.data,
            })
            .from(storedEvents)
            .where(eq(storedEvents.type, REFERRAL_EVENT_TYPE))
            .orderBy(asc(storedEvents.createdAt), asc(storedEvents.id)),
    ]);

    const currentCodes = new Map<string, string>();
    for (const account of accounts) {
        currentCodes.set(
            account.id,
            normalizeReferralCode(account.id.slice(0, 12)),
        );
    }

    for (const event of events) {
        const eventCode = codeFromCodeSetEventData(event.data);
        if (eventCode) {
            currentCodes.set(event.aggregateId, eventCode);
        }
    }

    for (const [accountId, currentCode] of currentCodes) {
        if (currentCode === code) {
            return accountId;
        }
    }

    return null;
}

async function hasActiveRaisedBed(accountId: string) {
    const gardens = await getAccountGardens(accountId);
    for (const garden of gardens) {
        const raisedBeds = await getRaisedBeds(garden.id, { status: 'active' });
        if (raisedBeds.length > 0) return true;
    }
    return false;
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
                timeZone: dbAccount?.timeZone,
                createdAt: dbAccount?.createdAt.toISOString(),
                updatedAt: dbAccount?.updatedAt.toISOString(),
            });
        },
    )
    .get(
        '/current/users',
        describeRoute({
            description: 'Get users assigned to the current account',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const users = await getAccountUsers(accountId);

            return context.json(
                users.map((accountUser) => ({
                    id: accountUser.user.id,
                    userName: accountUser.user.userName,
                    displayName:
                        accountUser.user.displayName ??
                        accountUser.user.userName,
                    avatarUrl: accountUser.user.avatarUrl,
                    assignedAt: accountUser.createdAt.toISOString(),
                })),
            );
        },
    )
    .patch(
        '/current',
        describeRoute({
            description: 'Update the current account settings',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const body = await context.req.json<{ timeZone?: string }>();

            if (body.timeZone !== undefined) {
                await updateAccountTimeZone(accountId, body.timeZone);
            }

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
                timeZone: dbAccount?.timeZone,
                createdAt: dbAccount?.createdAt.toISOString(),
                updatedAt: dbAccount?.updatedAt.toISOString(),
            });
        },
    )
    .get(
        '/current/referrals',
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const events = await getEvents(
                REFERRAL_EVENT_TYPE,
                [accountId],
                0,
                1000,
            );

            let myCode = '';
            let usedReferralCode: string | null = null;
            const referredAccounts: Array<{
                accountId: string;
                rewarded: boolean;
            }> = [];

            for (const event of events) {
                const data = event.data as Record<string, unknown> | null;
                if (
                    data?.action === 'code_set' &&
                    typeof data.code === 'string'
                ) {
                    myCode = data.code;
                }
                if (
                    data?.action === 'used_code' &&
                    typeof data.code === 'string'
                ) {
                    usedReferralCode = data.code;
                }
                if (
                    data?.action === 'referred_account' &&
                    typeof data.referredAccountId === 'string'
                ) {
                    referredAccounts.push({
                        accountId: data.referredAccountId,
                        rewarded: data.rewarded === true,
                    });
                }
            }

            if (!myCode) {
                myCode = normalizeReferralCode(accountId.slice(0, 12));
            }

            return context.json({
                myCode,
                usedReferralCode,
                referredAccounts,
                rewardAmount: REFERRAL_REWARD,
                referralLink: getReferralLink(myCode),
            });
        },
    )
    .post(
        '/current/referrals/code',
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const body = await context.req.json<{ code?: string }>();
            const code = normalizeReferralCode(body.code ?? '');
            if (!code) return context.json({ error: 'Neispravan kod' }, 400);
            if (await hasActiveRaisedBed(accountId)) {
                return context.json(
                    { error: 'Kod se ne može mijenjati nakon aktivne gredice' },
                    400,
                );
            }

            try {
                await storage().transaction(async (tx) => {
                    await tx.execute(
                        sql`select pg_advisory_xact_lock(hashtext(${`referral-code:${code}`}));`,
                    );

                    const ownerAccountId = await getReferralCodeOwnerAccountId(
                        code,
                        tx,
                    );
                    if (ownerAccountId && ownerAccountId !== accountId) {
                        throw new ReferralCodeAlreadyExistsError();
                    }

                    await tx.insert(storedEvents).values({
                        type: REFERRAL_EVENT_TYPE,
                        version: 1,
                        aggregateId: accountId,
                        data: { action: 'code_set', code },
                    });
                });
            } catch (error) {
                if (error instanceof ReferralCodeAlreadyExistsError) {
                    return context.json(
                        { error: 'Kod preporuke je već zauzet' },
                        409,
                    );
                }
                throw error;
            }

            return context.json({ code });
        },
    )
    .post(
        '/current/referrals/use',
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const body = await context.req.json<{ code?: string }>();
            const code = normalizeReferralCode(body.code ?? '');
            if (!code) return context.json({ error: 'Neispravan kod' }, 400);

            const myEvents = await getEvents(
                REFERRAL_EVENT_TYPE,
                [accountId],
                0,
                1000,
            );
            if (
                myEvents.some(
                    (e) =>
                        (e.data as Record<string, unknown> | null)?.action ===
                        'used_code',
                )
            ) {
                return context.json(
                    { error: 'Referral kod je već iskorišten' },
                    400,
                );
            }

            await createEvent({
                type: REFERRAL_EVENT_TYPE,
                version: 1,
                aggregateId: accountId,
                data: { action: 'used_code', code },
            });
            return context.json({ ok: true });
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
        '/current/achievements',
        describeRoute({
            description: 'Get the current account achievements',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const achievements = await getAccountAchievements(accountId);
            return context.json({
                achievements: achievements.map((achievement) => ({
                    id: achievement.id,
                    key: achievement.achievementKey,
                    status: achievement.status,
                    rewardSunflowers: achievement.rewardSunflowers,
                    progressValue: achievement.progressValue,
                    threshold: achievement.threshold,
                    rewardGrantedAt:
                        achievement.rewardGrantedAt?.toISOString() ?? null,
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
    .get(
        '/current/invitations',
        describeRoute({
            description: 'Get pending invitations for the current account',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const invitations = await getAccountInvitations(accountId);
            return context.json(
                invitations.map((invitation) => ({
                    id: invitation.id,
                    email: invitation.email,
                    status: invitation.status,
                    invitedBy: {
                        id: invitation.invitedByUser.id,
                        displayName:
                            invitation.invitedByUser.displayName ??
                            invitation.invitedByUser.userName,
                    },
                    expiresAt: invitation.expiresAt.toISOString(),
                    createdAt: invitation.createdAt.toISOString(),
                })),
            );
        },
    )
    .post(
        '/current/invitations',
        describeRoute({
            description: 'Send an invitation to join the current account',
        }),
        zValidator(
            'json',
            z.object({
                email: z.string().email(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId, userId } = context.get('authContext');
            const { email } = context.req.valid('json');

            // Check if user is already a member
            const existingUsers = await getAccountUsers(accountId);
            const alreadyMember = existingUsers.some(
                (u) => u.user.userName.toLowerCase() === email.toLowerCase(),
            );
            if (alreadyMember) {
                return context.json(
                    {
                        error: 'User is already a member of this account',
                        code: 'already_member',
                    },
                    400,
                );
            }

            // Check if there is already a pending invitation for this email
            const existingInvitations = await getAccountInvitations(accountId);
            const alreadyInvited = existingInvitations.some(
                (i) => i.email.toLowerCase() === email.toLowerCase(),
            );
            if (alreadyInvited) {
                return context.json(
                    {
                        error: 'An invitation has already been sent to this email',
                        code: 'already_invited',
                    },
                    400,
                );
            }

            const invitation = await createAccountInvitation(
                accountId,
                email,
                userId,
            );

            if (!invitation) {
                return context.json(
                    {
                        error: 'Failed to create invitation',
                        code: 'invitation_creation_failed',
                    },
                    500,
                );
            }

            // Get inviter info for the email
            const inviter = await getUser(userId);
            const inviterName =
                inviter?.displayName ?? inviter?.userName ?? 'Korisnik';

            const acceptUrl = `https://vrt.gredice.com/pozivnica?token=${invitation.token}`;

            try {
                await sendAccountInvitation(email, {
                    email,
                    invitedByName: inviterName,
                    acceptUrl,
                });
            } catch {
                // Roll back the invitation so the user can retry
                await cancelAccountInvitation(invitation.id, accountId);
                return context.json(
                    {
                        error: 'Failed to send invitation email',
                        code: 'email_send_failed',
                    },
                    500,
                );
            }

            await (await getPostHogClient()).capture({
                distinctId: userId,
                event: 'account_invitation_sent',
                properties: {
                    account_id: accountId,
                    invitation_id: invitation.id,
                    invited_email_domain: getEmailDomain(email),
                },
            });

            return context.json(
                {
                    id: invitation.id,
                    email: invitation.email,
                    status: invitation.status,
                    expiresAt: invitation.expiresAt.toISOString(),
                    createdAt: invitation.createdAt.toISOString(),
                },
                201,
            );
        },
    )
    .delete(
        '/current/invitations/:invitationId',
        describeRoute({
            description: 'Cancel a pending invitation',
        }),
        zValidator(
            'param',
            z.object({
                invitationId: z.string(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const { invitationId } = context.req.valid('param');
            const invitationIdNumber = Number.parseInt(invitationId, 10);
            if (Number.isNaN(invitationIdNumber)) {
                return context.json({ error: 'Invalid invitation ID' }, 400);
            }

            const result = await cancelAccountInvitation(
                invitationIdNumber,
                accountId,
            );
            if (!result) {
                return context.json({ error: 'Invitation not found' }, 404);
            }

            return context.json({ success: true });
        },
    )
    .post(
        '/invitations/accept',
        describeRoute({
            description: 'Accept an account invitation',
        }),
        zValidator(
            'json',
            z.object({
                token: z.string(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { userId } = context.get('authContext');
            const { token } = context.req.valid('json');

            // Verify the accepting user's email matches the invitation
            const invitation = await getAccountInvitationByToken(token);
            if (!invitation) {
                return context.json(
                    {
                        error: 'Invalid or expired invitation',
                        code: 'invalid_invitation',
                    },
                    400,
                );
            }

            const user = await getUser(userId);
            if (
                !user ||
                user.userName.toLowerCase() !== invitation.email.toLowerCase()
            ) {
                return context.json(
                    {
                        error: 'Invitation was sent to a different email address',
                        code: 'email_mismatch',
                    },
                    403,
                );
            }

            const result = await acceptAccountInvitation(token, userId);
            if (!result) {
                return context.json(
                    {
                        error: 'Invalid or expired invitation',
                        code: 'invalid_invitation',
                    },
                    400,
                );
            }

            // Switch the user to the invited account
            honoSetCookie(context, accountCookieName, result.accountId, {
                secure: true,
                httpOnly: true,
                sameSite: 'Lax',
                domain: cookieDomain,
                maxAge: 365 * 24 * 60 * 60, // 1 year
            });

            await (await getPostHogClient()).capture({
                distinctId: userId,
                event: 'account_invitation_accepted',
                properties: {
                    account_id: result.accountId,
                    invitation_id: invitation.id,
                    invited_by_user_id: invitation.invitedByUserId,
                },
            });

            return context.json({ success: true, accountId: result.accountId });
        },
    )
    .get(
        '/invitations/pending',
        describeRoute({
            description:
                'Get pending invitations for the current user by email',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { userId } = context.get('authContext');
            const user = await getUser(userId);
            if (!user) {
                return context.json({ error: 'User not found' }, 404);
            }

            const invitations = await getAccountInvitationsByEmail(
                user.userName,
            );
            return context.json(
                invitations.map((invitation) => ({
                    id: invitation.id,
                    token: invitation.token,
                    invitedBy: {
                        id: invitation.invitedByUser.id,
                        displayName:
                            invitation.invitedByUser.displayName ??
                            invitation.invitedByUser.userName,
                    },
                    expiresAt: invitation.expiresAt.toISOString(),
                    createdAt: invitation.createdAt.toISOString(),
                })),
            );
        },
    )
    .get(
        '/gardens',
        describeRoute({
            description:
                'Get garden picker groups for every account the current user can access.',
            security: authSecurity,
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const {
                accountId: currentAccountId,
                user,
                userId,
            } = context.get('authContext');
            const currentUser = await getUser(userId);
            const fallbackEmail = currentUser?.userName ?? 'Gredice';
            const orderedAccountIds = [
                currentAccountId,
                ...user.accountIds.filter(
                    (accountId) => accountId !== currentAccountId,
                ),
            ];

            const accountGardenGroups = await Promise.all(
                orderedAccountIds.map(async (accountId) => {
                    const [accountUsers, gardens] = await Promise.all([
                        getAccountUsers(accountId),
                        getAccountGardens(accountId),
                    ]);
                    const accountEmail =
                        accountUsers[0]?.user.userName ?? fallbackEmail;

                    return {
                        accountId,
                        name: `${accountEmail} račun`,
                        isCurrent: accountId === currentAccountId,
                        gardens: gardens.map((garden) => ({
                            id: garden.id,
                            name: garden.name,
                            createdAt: garden.createdAt,
                        })),
                    };
                }),
            );

            return context.json(accountGardenGroups);
        },
    )
    .post(
        '/switch',
        describeRoute({
            description: 'Switch the active account for the current user',
            security: authSecurity,
        }),
        zValidator(
            'json',
            z.object({
                accountId: z.string(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { user } = context.get('authContext');
            const { accountId } = context.req.valid('json');

            if (!user.accountIds.includes(accountId)) {
                return context.json(
                    { error: 'Account not found or not accessible' },
                    403,
                );
            }

            honoSetCookie(context, accountCookieName, accountId, {
                secure: true,
                httpOnly: true,
                sameSite: 'Lax',
                domain: cookieDomain,
                maxAge: 365 * 24 * 60 * 60,
            });

            return context.json({ success: true, accountId });
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
            let requestedAccountId: string | undefined;
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
                const accountIdClaim = result.payload.accountId;
                requestedAccountId =
                    typeof accountIdClaim === 'string'
                        ? accountIdClaim
                        : undefined;
            } catch (error) {
                console.warn('Error verifying JWT:', error);
                return context.json({ error: 'Invalid or expired link.' }, 400);
            }

            try {
                const user = await getUser(currentUserId);
                const accountIds =
                    user?.accounts?.map((a) => a.accountId) ?? [];
                const accountId =
                    requestedAccountId &&
                    accountIds.includes(requestedAccountId)
                        ? requestedAccountId
                        : undefined;
                if (!accountId) {
                    return context.json(
                        { error: 'Invalid or expired link.' },
                        400,
                    );
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
    )
    .post(
        '/delete-request',
        describeRoute({
            description:
                'Requests account deletion by sending a confirmation email.',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { user, accountId } = context.get('authContext');
            const accountUsers = await getAccountUsers(accountId);
            if (accountUsers.length !== 1) {
                return context.json(
                    { error: 'Račun mora imati točno jednog korisnika.' },
                    400,
                );
            }

            const accountUser = accountUsers[0];
            if (!accountUser || accountUser.userId !== user.id) {
                return context.json(
                    { error: 'Račun mora imati točno jednog korisnika.' },
                    400,
                );
            }
            const token = await createJwt(
                {
                    sub: user.id,
                    accountId,
                },
                '72h',
            );
            const confirmLink = `https://vrt.gredice.com/racun/brisanje?token=${token}`;
            const email = accountUser.user.userName;
            await sendEmail({
                from: 'suncokret@obavijesti.gredice.com',
                to: email,
                subject: 'Gredice - potvrda brisanja računa',
                template: AccountDeleteConfirmationTemplate({
                    confirmLink,
                    email,
                }),
                templateName: 'account-delete-confirmation',
                messageType: 'account',
                metadata: { accountId },
            });
            return context.json({
                success: true,
            });
        },
    );

export default app;
