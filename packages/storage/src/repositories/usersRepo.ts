import 'server-only';
import { eq, sql } from "drizzle-orm";
import { storage } from "..";
import { accounts, accountUsers, userLogins, users } from "../schema";
import { randomUUID } from 'node:crypto';
import { createGarden } from "./gardensRepo";

export function getUsers() {
    return storage.query.users.findMany();
}

export function getUser(userId: string) {
    return storage.query.users.findFirst({
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

export function getUserWithLogins(userName: string) {
    return storage.query.users.findFirst({
        where: eq(users.userName, userName),
        with: {
            usersLogins: true
        }
    });
}

export async function createUserWithPassword(userName: string, passwordHash: string, salt: string) {
    // Create account
    const account = storage
        .insert(accounts)
        .values({
            id: randomUUID(),
        })
        .returning({ id: accounts.id });
    const accountId = (await account)[0].id;
    if (!accountId) {
        throw new Error('Failed to create account');
    }

    // Create default garden
    await createGarden({
        accountId,
        name: 'Vrt od ' + userName
    });

    // Create user
    const createdUsers = await storage
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

    // Link user to account
    await storage.insert(accountUsers).values({
        accountId,
        userId
    });

    // Insert the password login
    await storage.insert(userLogins).values({
        userId,
        loginType: 'password',
        loginId: userName,
        loginData: JSON.stringify({ salt, password: passwordHash })
    });

    return userId;
}

export async function updateUserRole(userId: string, newRole: string) {
    await storage.update(users).set({ role: newRole }).where(eq(users.id, userId));
}

export async function incLoginFailedAttempts(loginId: number) {
    await storage.update(userLogins).set({
        failedAttempts: sql`${userLogins.failedAttempts} + 1`,
        lastFailedAttempt: new Date()
    }).where(eq(userLogins.id, loginId));
}

export async function blockLogin(loginId: number, blockedUntil: Date) {
    await storage.update(userLogins).set({
        blockedUntil
    }).where(eq(userLogins.id, loginId));
}

export async function clearLoginFailedAttempts(loginId: number) {
    await storage.update(userLogins).set({
        failedAttempts: 0,
        lastFailedAttempt: null,
        blockedUntil: null
    }).where(eq(userLogins.id, loginId));
}
