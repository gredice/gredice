import 'server-only';
import {
    randomBytes as cryptoRandomBytes,
    pbkdf2Sync,
    randomInt,
    randomUUID,
} from 'node:crypto';
import { and, desc, eq, lt, ne, sql } from 'drizzle-orm';
import { createAccount, storage } from '..';
import {
    accountUsers,
    type UpdateUserInfo,
    userLogins,
    users,
} from '../schema';
import { createEvent, knownEvents } from './eventsRepo';
import {
    createDefaultGardenForAccount,
    createSandboxGarden,
} from './gardensRepo';
import { deleteRefreshTokensForUser } from './refreshTokensRepo';

const temporaryAccountInactivityDays = 30;
const temporaryUserNameSuffixMin = 1000;
const temporaryUserNameSuffixMax = 9999;
const temporaryUserNameMaxAttempts = 12;
const temporaryActivityTouchIntervalMs = 60 * 60 * 1000;

const temporaryUserNamePrefixes = [
    'Mali Suncokret',
    'Bosiljak Na Pauzi',
    'Vrtni Majstor',
    'Tihi Komposter',
    'Brzi Zaljevac',
    'Sunce U Tegli',
    'Veseli Rasad',
    'Zelena Patrola',
];

export interface OAuthUserData {
    name: string;
    email: string;
    providerUserId: string;
    provider: 'google' | 'facebook';
}

export function getUsers() {
    return storage().query.users.findMany({
        orderBy: desc(users.createdAt),
    });
}

export function getUser(userId: string) {
    return storage().query.users.findFirst({
        where: eq(users.id, userId),
        with: {
            accounts: {
                with: {
                    account: true,
                },
            },
        },
    });
}

export function getUsersWithBirthdayOn(month: number, day: number) {
    return storage().query.users.findMany({
        where: and(eq(users.birthdayMonth, month), eq(users.birthdayDay, day)),
        with: {
            accounts: {
                with: {
                    account: true,
                },
            },
        },
    });
}

export function updateUser(user: { id: string } & Partial<UpdateUserInfo>) {
    return storage()
        .update(users)
        .set({
            ...user,
        })
        .where(eq(users.id, user.id));
}

export function getUserWithLogins(userName: string) {
    return storage().query.users.findFirst({
        where: eq(users.userName, userName),
        with: {
            usersLogins: true,
        },
    });
}

export async function getUserWithLoginsByLogin(
    loginType: string,
    loginId: string,
) {
    const login = await storage().query.userLogins.findFirst({
        where: and(
            eq(userLogins.loginType, loginType),
            eq(userLogins.loginId, loginId),
        ),
        with: {
            user: {
                with: {
                    usersLogins: true,
                },
            },
        },
    });

    return login?.user ?? null;
}

export function getLastUserLogin(userId: string) {
    return storage().query.userLogins.findFirst({
        where: eq(userLogins.userId, userId),
        orderBy: desc(userLogins.lastLogin),
    });
}

export function loginSuccessful(userLoginId: number) {
    return storage()
        .update(userLogins)
        .set({
            lastLogin: new Date(),
        })
        .where(eq(userLogins.id, userLoginId));
}

async function createUser(
    userName: string,
    displayName?: string,
    options?: {
        isTemporary?: boolean;
        lastActiveAt?: Date;
    },
) {
    await ensureUserNameIsUnique(userName);
    const createdUsers = await storage()
        .insert(users)
        .values({
            id: randomUUID(),
            userName,
            displayName,
            role: 'user',
            isTemporary: options?.isTemporary ?? false,
            ...(options?.lastActiveAt
                ? { lastActiveAt: options.lastActiveAt }
                : {}),
        })
        .returning({ id: users.id });
    const userId = createdUsers[0].id;
    if (!userId) {
        throw new Error('Failed to create user');
    }
    await createEvent(knownEvents.users.createdV1(userId));
    return userId;
}

async function ensureUserNameIsUnique(userName: string, exceptUserId?: string) {
    const userNameExists = Boolean(
        await storage().query.users.findFirst({
            where: exceptUserId
                ? and(eq(users.userName, userName), ne(users.id, exceptUserId))
                : eq(users.userName, userName),
        }),
    );
    if (userNameExists) {
        throw new Error('User with provided user name already exists');
    }
}

async function createUserAndAccount(
    userName: string,
    displayName?: string,
    timeZone?: string,
) {
    const userId = await createUser(userName, displayName);
    const accountId = await createAccount(timeZone);
    await createDefaultGardenForAccount({ accountId });

    // Link user to account
    await storage().insert(accountUsers).values({
        accountId,
        userId,
    });
    await createEvent(
        knownEvents.accounts.assignedUserV1(accountId, { userId }),
    );

    return userId;
}

function randomTemporaryUserName() {
    const prefix =
        temporaryUserNamePrefixes[
            randomInt(0, temporaryUserNamePrefixes.length)
        ];
    const suffix = randomInt(
        temporaryUserNameSuffixMin,
        temporaryUserNameSuffixMax + 1,
    );
    return `${prefix} ${suffix.toString()}`;
}

async function createUniqueTemporaryUserName() {
    for (let attempt = 0; attempt < temporaryUserNameMaxAttempts; attempt++) {
        const userName = randomTemporaryUserName();
        const existing = await storage().query.users.findFirst({
            where: eq(users.userName, userName),
        });
        if (!existing) {
            return userName;
        }
    }

    return `Vrtni Majstor ${randomUUID().slice(0, 8)}`;
}

export async function createTemporaryUserAndAccount(timeZone?: string) {
    const now = new Date();
    const displayName = await createUniqueTemporaryUserName();
    const userId = await createUser(displayName, displayName, {
        isTemporary: true,
        lastActiveAt: now,
    });
    const accountId = await createAccount(timeZone);
    await createSandboxGarden({ accountId });

    await storage().insert(accountUsers).values({
        accountId,
        userId,
    });
    await createEvent(
        knownEvents.accounts.assignedUserV1(accountId, { userId }),
    );

    return {
        accountId,
        displayName,
        userId,
        userName: displayName,
    };
}

export async function touchTemporaryUserActivity(
    userId: string,
    options?: {
        force?: boolean;
        now?: Date;
    },
) {
    const now = options?.now ?? new Date();
    const threshold = new Date(
        now.getTime() - temporaryActivityTouchIntervalMs,
    );

    await storage()
        .update(users)
        .set({ lastActiveAt: now })
        .where(
            and(
                eq(users.id, userId),
                eq(users.isTemporary, true),
                options?.force ? sql`true` : lt(users.lastActiveAt, threshold),
            ),
        );
}

export async function promoteTemporaryUser({
    displayName,
    userId,
    userName,
}: {
    displayName?: string;
    userId: string;
    userName: string;
}) {
    const user = await storage().query.users.findFirst({
        where: eq(users.id, userId),
    });
    if (!user?.isTemporary) {
        throw new Error('Temporary user not found');
    }

    await ensureUserNameIsUnique(userName, userId);
    await storage()
        .update(users)
        .set({
            userName,
            displayName: displayName ?? user.displayName ?? userName,
            isTemporary: false,
            lastActiveAt: new Date(),
        })
        .where(eq(users.id, userId));
}

export async function deleteUserAuthenticationData(userId: string) {
    await deleteRefreshTokensForUser(userId);
    await storage().delete(userLogins).where(eq(userLogins.userId, userId));
}

export async function attachTemporaryAccountsToUser({
    targetUserId,
    temporaryUserId,
}: {
    targetUserId: string;
    temporaryUserId: string;
}) {
    if (targetUserId === temporaryUserId) {
        return { accountIds: [] };
    }

    const temporaryUser = await storage().query.users.findFirst({
        where: eq(users.id, temporaryUserId),
        with: {
            accounts: true,
        },
    });
    if (!temporaryUser?.isTemporary) {
        return { accountIds: [] };
    }

    const targetUser = await storage().query.users.findFirst({
        where: eq(users.id, targetUserId),
    });
    if (!targetUser) {
        throw new Error('Target user not found');
    }

    const attachedAccountIds: string[] = [];
    for (const accountUser of temporaryUser.accounts) {
        const existingTargetLink = await storage().query.accountUsers.findFirst(
            {
                where: and(
                    eq(accountUsers.accountId, accountUser.accountId),
                    eq(accountUsers.userId, targetUserId),
                ),
            },
        );

        if (existingTargetLink) {
            await storage()
                .delete(accountUsers)
                .where(eq(accountUsers.id, accountUser.id));
        } else {
            await storage()
                .update(accountUsers)
                .set({ userId: targetUserId })
                .where(eq(accountUsers.id, accountUser.id));
            await createEvent(
                knownEvents.accounts.assignedUserV1(accountUser.accountId, {
                    userId: targetUserId,
                }),
            );
        }

        attachedAccountIds.push(accountUser.accountId);
    }

    await deleteUserAuthenticationData(temporaryUserId);
    await storage().delete(users).where(eq(users.id, temporaryUserId));

    return { accountIds: attachedAccountIds };
}

function passwordHash(password: string) {
    const salt = cryptoRandomBytes(128).toString('base64');
    return {
        salt,
        hash: pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex'),
    };
}

export async function createUserPasswordLogin(
    userId: string,
    userName: string,
    password: string,
) {
    const { salt, hash } = passwordHash(password);
    await storage()
        .insert(userLogins)
        .values({
            userId,
            loginType: 'password',
            loginId: userName,
            loginData: JSON.stringify({
                salt,
                password: hash,
                isVerified: false,
            }),
        });
}

export async function createOrUpdateUserPasswordLogin(
    userId: string,
    userName: string,
    password: string,
) {
    const { salt, hash } = passwordHash(password);
    const loginData = JSON.stringify({
        salt,
        password: hash,
        isVerified: false,
    });
    const existingLogin = await storage().query.userLogins.findFirst({
        where: and(
            eq(userLogins.userId, userId),
            eq(userLogins.loginType, 'password'),
            eq(userLogins.loginId, userName),
        ),
    });

    if (existingLogin) {
        await storage()
            .update(userLogins)
            .set({ loginData })
            .where(eq(userLogins.id, existingLogin.id));
        return existingLogin.id;
    }

    const inserted = await storage()
        .insert(userLogins)
        .values({
            userId,
            loginType: 'password',
            loginId: userName,
            loginData,
        })
        .returning({ id: userLogins.id });

    return inserted[0].id;
}

/**
 * Creates a user with a password login
 * @param userName The user name
 * @param password The password
 * @returns The user id
 */
export async function createUserWithPassword(
    userName: string,
    password: string,
) {
    const userId = await createUserAndAccount(userName);
    await createUserPasswordLogin(userId, userName, password);
    return userId;
}

export async function createOrUpdateUserWithOauth(
    data: OAuthUserData,
    loggedInUserId?: string,
    timeZone?: string,
) {
    const loggedInUser = loggedInUserId ? await getUser(loggedInUserId) : null;
    const loggedInUserIsTemporary = Boolean(loggedInUser?.isTemporary);

    // Fast return if user has login provider with given loginId
    const existingLogin = await storage().query.userLogins.findFirst({
        where: and(
            eq(userLogins.loginType, data.provider),
            eq(userLogins.loginId, data.providerUserId),
        ),
        with: {
            user: true,
        },
    });
    if (existingLogin) {
        if (
            loggedInUserIsTemporary &&
            loggedInUserId &&
            loggedInUserId !== existingLogin.userId
        ) {
            const attached = await attachTemporaryAccountsToUser({
                temporaryUserId: loggedInUserId,
                targetUserId: existingLogin.userId,
            });
            return {
                userId: existingLogin.userId,
                loginId: existingLogin.id,
                attachedTemporaryAccountIds: attached.accountIds,
            };
        }

        if (loggedInUserId && loggedInUserId !== existingLogin.userId) {
            throw new Error('Provider not assigned to the user.');
        }

        return {
            userId: existingLogin.userId,
            loginId: existingLogin.id,
        };
    }

    // If user with given email doesn't exist, create a new user
    let existingUser = await storage().query.users.findFirst({
        where: eq(users.userName, data.email),
        with: {
            usersLogins: true,
        },
    });
    let isNewUser = false;
    let attachedTemporaryAccountIds: string[] | undefined;

    if (loggedInUserIsTemporary && loggedInUserId) {
        if (!existingUser) {
            await promoteTemporaryUser({
                userId: loggedInUserId,
                userName: data.email,
                displayName: data.name,
            });
            existingUser = await storage().query.users.findFirst({
                where: eq(users.id, loggedInUserId),
                with: {
                    usersLogins: true,
                },
            });
            isNewUser = true;
        } else if (existingUser.id !== loggedInUserId) {
            const attached = await attachTemporaryAccountsToUser({
                temporaryUserId: loggedInUserId,
                targetUserId: existingUser.id,
            });
            attachedTemporaryAccountIds = attached.accountIds;
        }
    }

    if (!existingUser) {
        const createdUserId = await createUserAndAccount(
            data.email,
            data.name,
            timeZone,
        );
        existingUser = await storage().query.users.findFirst({
            where: eq(users.id, createdUserId),
            with: {
                usersLogins: true,
            },
        });
        isNewUser = true;
    }

    if (
        !existingUser || // If we failed to create the user by email or retreive existing one
        (!loggedInUserIsTemporary &&
            loggedInUserId &&
            loggedInUserId !== existingUser.id) || // If current user does not match the user
        (!loggedInUserIsTemporary &&
            loggedInUserId &&
            existingUser.usersLogins.length !== 0)
    ) {
        // If current user is logged in and it does not match the user or user already has logins
        throw new Error('Provider not assigned to the user.');
    }

    const loginId = (
        await storage()
            .insert(userLogins)
            .values({
                userId: existingUser.id,
                loginType: data.provider,
                loginId: data.providerUserId,
                loginData: JSON.stringify({ isVerified: true }),
            })
            .returning({ id: userLogins.id })
    )[0].id;
    return {
        userId: existingUser.id,
        loginId,
        isNewUser,
        attachedTemporaryAccountIds,
    };
}

export async function updateUserRole(userId: string, newRole: string) {
    await storage()
        .update(users)
        .set({ role: newRole })
        .where(eq(users.id, userId));
}

export async function incLoginFailedAttempts(loginId: number) {
    await storage()
        .update(userLogins)
        .set({
            failedAttempts: sql`${userLogins.failedAttempts} + 1`,
            lastFailedAttempt: new Date(),
        })
        .where(eq(userLogins.id, loginId));
}

export async function blockLogin(loginId: number, blockedUntil: Date) {
    await storage()
        .update(userLogins)
        .set({
            blockedUntil,
        })
        .where(eq(userLogins.id, loginId));
}

export async function clearLoginFailedAttempts(loginId: number) {
    await storage()
        .update(userLogins)
        .set({
            failedAttempts: 0,
            lastFailedAttempt: null,
            blockedUntil: null,
        })
        .where(eq(userLogins.id, loginId));
}

export async function updateLoginData(
    loginId: number,
    data: Record<string, unknown>,
) {
    await storage()
        .update(userLogins)
        .set({
            loginData: JSON.stringify(data),
        })
        .where(eq(userLogins.id, loginId));
}

export async function changePassword(loginId: number, newPassword: string) {
    const { salt, hash } = passwordHash(newPassword);
    await updateLoginData(loginId, { salt, password: hash, isVerified: true });
}

export async function cleanupInactiveTemporaryAccounts(options?: {
    batchSize?: number;
    inactiveDays?: number;
    now?: Date;
}) {
    const batchSize = Math.max(1, Math.floor(options?.batchSize ?? 50));
    const inactiveDays =
        options?.inactiveDays ?? temporaryAccountInactivityDays;
    const now = options?.now ?? new Date();
    const cutoff = new Date(now.getTime() - inactiveDays * 24 * 60 * 60 * 1000);
    const candidates = await storage().query.users.findMany({
        where: and(eq(users.isTemporary, true), lt(users.lastActiveAt, cutoff)),
        with: {
            accounts: true,
        },
        limit: batchSize,
    });

    let deletedUsers = 0;
    let deletedAccounts = 0;
    const failedUserIds: string[] = [];
    const { deleteAccountWithDependencies } = await import(
        './accountDeletionRepo'
    );

    for (const candidate of candidates) {
        try {
            if (candidate.accounts.length === 0) {
                await deleteUserAuthenticationData(candidate.id);
                await storage().delete(users).where(eq(users.id, candidate.id));
                deletedUsers++;
                continue;
            }

            for (const accountUser of candidate.accounts) {
                await deleteAccountWithDependencies(
                    accountUser.accountId,
                    candidate.id,
                );
                deletedAccounts++;
            }
            deletedUsers++;
        } catch (error) {
            console.error('Failed to clean up temporary user', {
                error,
                userId: candidate.id,
            });
            failedUserIds.push(candidate.id);
        }
    }

    return {
        checkedUsers: candidates.length,
        cutoff,
        deletedAccounts,
        deletedUsers,
        failedUserIds,
    };
}
