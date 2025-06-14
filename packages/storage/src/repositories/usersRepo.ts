import 'server-only';
import { desc, eq, sql } from "drizzle-orm";
import { createAccount, getFarms, storage } from "..";
import { accountUsers, UpdateUserInfo, userLogins, users } from "../schema";
import { createGarden } from "./gardensRepo";
import { randomUUID, randomBytes as cryptoRandomBytes, pbkdf2Sync } from 'node:crypto';
import { createEvent, knownEvents } from './eventsRepo';

export function getUsers() {
    return storage().query.users.findMany({
        orderBy: desc(users.createdAt)
    });
}

export function getUser(userId: string) {
    return storage().query.users.findFirst({
        where: eq(users.id, userId),
        with: {
            accounts: {
                with: {
                    account: true
                }
            }
        }
    });
}

export function updateUser(user: { id: string } & Partial<UpdateUserInfo>) {
    return storage()
        .update(users)
        .set({
            ...user
        })
        .where(eq(users.id, user.id));
}

export function getUserWithLogins(userName: string) {
    return storage().query.users.findFirst({
        where: eq(users.userName, userName),
        with: {
            usersLogins: true
        }
    });
}

export function loginSuccessful(userLoginId: number) {
    return storage().update(userLogins).set({
        lastLogin: new Date()
    }).where(eq(userLogins.id, userLoginId));
}

/**
 * Creates a user with a password login
 * @param userName The user name
 * @param password The password
 * @returns The user id
 */
export async function createUserWithPassword(userName: string, password: string) {
    // Check if user already exists
    const existingUser = await storage().query.users.findFirst({
        where: eq(users.userName, userName)
    });
    if (existingUser) {
        throw new Error('User already exists');
    }

    // Create account
    const accountId = await createAccount();

    // Create default farm
    const farm = (await getFarms())[0];
    if (!farm) {
        throw new Error('No farm found');
    }
    await createGarden({
        farmId: farm.id,
        accountId,
        name: 'Moj vrt'
    });

    // Create user
    const createdUsers = await storage()
        .insert(users)
        .values({
            id: randomUUID(),
            userName,
            role: 'user'
        })
        .returning({ id: users.id });
    const userId = createdUsers[0].id;
    if (!userId) {
        throw new Error('Failed to create user');
    }
    await createEvent(knownEvents.users.createdV1(userId));

    // Link user to account
    await storage().insert(accountUsers).values({
        accountId,
        userId
    });
    await createEvent(knownEvents.accounts.assignedUserV1(accountId, { userId }));

    // Insert the password login
    const salt = cryptoRandomBytes(128).toString('base64');
    const passwordHash = pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex');
    await storage().insert(userLogins).values({
        userId,
        loginType: 'password',
        loginId: userName,
        loginData: JSON.stringify({ salt, password: passwordHash, isVerified: false }),
    });

    return userId;
}

export async function updateUserRole(userId: string, newRole: string) {
    await storage().update(users).set({ role: newRole }).where(eq(users.id, userId));
}

export async function incLoginFailedAttempts(loginId: number) {
    await storage().update(userLogins).set({
        failedAttempts: sql`${userLogins.failedAttempts} + 1`,
        lastFailedAttempt: new Date()
    }).where(eq(userLogins.id, loginId));
}

export async function blockLogin(loginId: number, blockedUntil: Date) {
    await storage().update(userLogins).set({
        blockedUntil
    }).where(eq(userLogins.id, loginId));
}

export async function clearLoginFailedAttempts(loginId: number) {
    await storage().update(userLogins).set({
        failedAttempts: 0,
        lastFailedAttempt: null,
        blockedUntil: null
    }).where(eq(userLogins.id, loginId));
}

export async function updateLoginData(loginId: number, data: Record<string, any>) {
    await storage().update(userLogins).set({
        loginData: JSON.stringify(data)
    }).where(eq(userLogins.id, loginId));
}

export async function changePassword(loginId: number, newPassword: string) {
    const salt = cryptoRandomBytes(128).toString('base64');
    const passwordHash = pbkdf2Sync(newPassword, salt, 10000, 512, 'sha512').toString('hex');
    await storage().update(userLogins).set({
        loginData: JSON.stringify({ salt, password: passwordHash, isVerified: true })
    }).where(eq(userLogins.id, loginId));
}
