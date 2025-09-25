import { getUser, getUserWithLogins, updateUser } from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';
import {
    type BirthdayRewardUser,
    grantBirthdayReward,
} from '../../../lib/users/birthdayRewards';
import {
    differenceInCalendarDays,
    getLastBirthdayOccurrence,
    isValidBirthday,
    startOfUtcDay,
} from '../../../lib/users/birthdayUtils';

const currentYear = new Date().getUTCFullYear();
const birthdaySchema = z
    .object({
        day: z.number().int().min(1).max(31),
        month: z.number().int().min(1).max(12),
        year: z.number().int().min(1900).max(currentYear).optional(),
    })
    .strict();

const app = new Hono<{ Variables: AuthVariables }>()
    .get(
        '/current',
        describeRoute({
            description: 'Get the current user.',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { userId } = context.get('authContext');
            const dbUser = await getUser(userId);
            if (!dbUser) {
                return context.json(
                    { error: 'User not found' },
                    { status: 404 },
                );
            }

            return context.json({
                id: dbUser.id,
                userName: dbUser.userName,
                displayName: dbUser.displayName ?? dbUser.userName,
                avatarUrl: dbUser.avatarUrl,
                birthday:
                    dbUser.birthdayMonth && dbUser.birthdayDay
                        ? {
                              day: dbUser.birthdayDay,
                              month: dbUser.birthdayMonth,
                              year: dbUser.birthdayYear ?? undefined,
                          }
                        : null,
                birthdayLastUpdatedAt: dbUser.birthdayLastUpdatedAt,
                birthdayLastRewardAt: dbUser.birthdayLastRewardAt,
                createdAt: dbUser.createdAt,
            });
        },
    )
    .get(
        '/:userId/logins',
        describeRoute({
            description:
                'Get the login methods of a user. Only the current user can view their own login methods.',
        }),
        zValidator(
            'param',
            z.object({
                userId: z.string(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { userId } = context.req.valid('param');
            const { userId: authUserId } = context.get('authContext');
            if (userId !== authUserId) {
                console.warn(
                    `User ${authUserId} tried to access login methods of user ${userId} without permission`,
                );
                return context.json(
                    { error: 'User not found' },
                    { status: 404 },
                );
            }

            const user = await getUser(userId);
            if (!user) {
                return context.json(
                    { error: 'User not found' },
                    { status: 404 },
                );
            }

            const loginMethods = await getUserWithLogins(user.userName);
            return context.json({
                methods:
                    loginMethods?.usersLogins.map((login) => ({
                        id: login.id,
                        provider: login.loginType,
                        providerUserId: login.loginId,
                        lastLogin: login.lastLogin,
                    })) || [],
            });
        },
    )
    .patch(
        '/:userId',
        describeRoute({
            description:
                'Update a user. Only the current user can update their own information. You can submit partial information to update only specific fields.',
        }),
        zValidator(
            'param',
            z.object({
                userId: z.string(),
            }),
        ),
        zValidator(
            'json',
            z
                .object({
                    userName: z.string().optional(),
                    displayName: z.string().optional(),
                    avatarUrl: z.string().optional().nullable(),
                    birthday: z.union([birthdaySchema, z.null()]).optional(),
                })
                .strict(),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { userId } = context.req.valid('param');
            const userInfo = context.req.valid('json');
            const { userId: authUserId } = context.get('authContext');
            if (userId !== authUserId) {
                console.warn(
                    `User ${authUserId} tried to update user ${userId} without permission`,
                );
                return context.json(
                    { error: 'User not found' },
                    { status: 404 },
                );
            }

            const dbUser = await getUser(userId);
            if (!dbUser) {
                return context.json(
                    { error: 'User not found' },
                    { status: 404 },
                );
            }

            const updatePayload: Record<string, unknown> = {};
            if (userInfo.displayName !== undefined) {
                updatePayload.displayName = userInfo.displayName;
            }
            if (userInfo.avatarUrl !== undefined) {
                updatePayload.avatarUrl = userInfo.avatarUrl;
            }
            if (userInfo.userName !== undefined) {
                updatePayload.userName = userInfo.userName;
            }

            let rewardDate: Date | undefined;
            let rewardIsLate = false;

            if (Object.hasOwn(userInfo, 'birthday')) {
                if (userInfo.birthday === null) {
                    updatePayload.birthdayDay = null;
                    updatePayload.birthdayMonth = null;
                    updatePayload.birthdayYear = null;
                    updatePayload.birthdayLastUpdatedAt = new Date();
                } else if (userInfo.birthday) {
                    const birthday = userInfo.birthday;
                    if (!isValidBirthday(birthday)) {
                        return context.json(
                            { error: 'Neispravan datum rođendana.' },
                            { status: 400 },
                        );
                    }

                    const birthdayChanged =
                        birthday.day !== dbUser.birthdayDay ||
                        birthday.month !== dbUser.birthdayMonth ||
                        (birthday.year ?? null) !==
                            (dbUser.birthdayYear ?? null);

                    if (birthdayChanged) {
                        const now = new Date();
                        if (dbUser.birthdayLastUpdatedAt) {
                            const nextAllowedChange = new Date(
                                dbUser.birthdayLastUpdatedAt,
                            );
                            nextAllowedChange.setUTCFullYear(
                                nextAllowedChange.getUTCFullYear() + 1,
                            );
                            if (now < nextAllowedChange) {
                                return context.json(
                                    {
                                        error: 'Rođendan je moguće mijenjati jednom godišnje. Kontaktiraj podršku ako trebaš dodatnu pomoć.',
                                    },
                                    { status: 400 },
                                );
                            }
                        }

                        updatePayload.birthdayDay = birthday.day;
                        updatePayload.birthdayMonth = birthday.month;
                        updatePayload.birthdayYear = birthday.year ?? null;
                        updatePayload.birthdayLastUpdatedAt = now;

                        const lastOccurrence = getLastBirthdayOccurrence(
                            birthday.month,
                            birthday.day,
                            now,
                        );
                        const daysSinceBirthday = differenceInCalendarDays(
                            now,
                            lastOccurrence,
                        );
                        const alreadyRewarded =
                            dbUser.birthdayLastRewardAt &&
                            dbUser.birthdayLastRewardAt >= lastOccurrence;

                        if (
                            daysSinceBirthday >= 0 &&
                            daysSinceBirthday <= 30 &&
                            !alreadyRewarded
                        ) {
                            rewardDate = startOfUtcDay(lastOccurrence);
                            rewardIsLate = daysSinceBirthday > 0;
                        }
                    }
                }
            }

            if (Object.keys(updatePayload).length > 0) {
                await updateUser({
                    id: userId,
                    ...updatePayload,
                });
            }

            let rewardResult: Awaited<
                ReturnType<typeof grantBirthdayReward>
            > | null = null;
            if (rewardDate) {
                const updatedUser: BirthdayRewardUser = {
                    ...dbUser,
                    birthdayDay: userInfo.birthday?.day ?? null,
                    birthdayMonth: userInfo.birthday?.month ?? null,
                    birthdayYear: userInfo.birthday?.year ?? null,
                };
                rewardResult = await grantBirthdayReward({
                    user: updatedUser,
                    rewardDate,
                    isLate: rewardIsLate,
                });
            }

            return context.json({
                success: true,
                birthdayReward:
                    rewardResult?.rewarded && rewardDate
                        ? {
                              rewardedAt: rewardDate,
                              accountId: rewardResult.accountId,
                              late: rewardIsLate,
                          }
                        : null,
            });
        },
    );

export default app;
