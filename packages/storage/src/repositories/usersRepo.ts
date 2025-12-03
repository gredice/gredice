import 'server-only';
import {
    randomBytes as cryptoRandomBytes,
    pbkdf2Sync,
    randomUUID,
} from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { createAccount, getFarms, storage } from '..';
import {
    accountUsers,
    type UpdateUserInfo,
    userLogins,
    users,
} from '../schema';
import { createEvent, knownEvents } from './eventsRepo';
import { createGarden } from './gardensRepo';

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

async function createUser(userName: string, displayName?: string) {
    await ensureUserNameIsUnique(userName);
    const createdUsers = await storage()
        .insert(users)
        .values({
            id: randomUUID(),
            userName,
            displayName,
            role: 'user',
        })
        .returning({ id: users.id });
    const userId = createdUsers[0].id;
    if (!userId) {
        throw new Error('Failed to create user');
    }
    await createEvent(knownEvents.users.createdV1(userId));
    return userId;
}

async function ensureUserNameIsUnique(userName: string) {
    const userNameExists = Boolean(
        await storage().query.users.findFirst({
            where: eq(users.userName, userName),
        }),
    );
    if (userNameExists) {
        throw new Error('User with provided user name already exists');
    }
}

async function getDefaultFarm() {
    const farm = (await getFarms())[0];
    if (!farm) {
        throw new Error('No farm found');
    }
    return farm;
}

async function createDefaultGarden(accountId: string) {
    const farm = await getDefaultFarm();

    // Create garden and get its ID
    const gardenId = await createGarden({
        farmId: farm.id,
        accountId,
        name: 'Moj vrt',
    });

    // Assign 4x3 grid of grass blocks and two raised beds at center
    // Grid: x = 0..3, y = 0..2
    // Center positions for raised beds: (1,1) and (2,1)
    const {
        createGardenBlock,
        createGardenStack,
        updateGardenStack,
        createRaisedBed,
    } = await import('./gardensRepo');
    const grassBlockIds: string[][] = [];
    for (let x = -1; x < 3; x++) {
        grassBlockIds[x] = [];
        for (let y = -1; y < 2; y++) {
            // Create base block
            const blockId = await createGardenBlock(gardenId, 'Block_Grass');
            grassBlockIds[x][y] = blockId;

            // Create stack if not exists
            await createGardenStack(gardenId, { x, y });

            const blockIds = [blockId];
            if ((x === 0 && y === 0) || (x === 1 && y === 0)) {
                const raisedBedBlockId = await createGardenBlock(
                    gardenId,
                    'Raised_Bed',
                );
                await createRaisedBed({
                    accountId,
                    gardenId,
                    blockId: raisedBedBlockId,
                    status: 'new',
                });
                blockIds.push(raisedBedBlockId);
            }

            // Assign block to stack
            await updateGardenStack(gardenId, { x, y, blocks: blockIds });
        }
    }
}

async function createUserAndAccount(
    userName: string,
    displayName?: string,
    timeZone?: string,
) {
    const userId = await createUser(userName, displayName);
    const accountId = await createAccount(timeZone);
    await createDefaultGarden(accountId);

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
        (loggedInUserId && loggedInUserId !== existingUser.id) || // If current user does not match the user
        (loggedInUserId && existingUser.usersLogins.length !== 0)
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
