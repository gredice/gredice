import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, gt, sql } from 'drizzle-orm';
import { accountInvitations, accountUsers, storage } from '..';

const INVITATION_EXPIRY_DAYS = 7;

export function getAccountInvitations(accountId: string) {
    return storage().query.accountInvitations.findMany({
        where: and(
            eq(accountInvitations.accountId, accountId),
            eq(accountInvitations.status, 'pending'),
            gt(accountInvitations.expiresAt, new Date()),
        ),
        with: {
            invitedByUser: true,
        },
    });
}

export function getAccountInvitationByToken(token: string) {
    return storage().query.accountInvitations.findFirst({
        where: and(
            eq(accountInvitations.token, token),
            eq(accountInvitations.status, 'pending'),
            gt(accountInvitations.expiresAt, new Date()),
        ),
        with: {
            account: true,
        },
    });
}

export function getAccountInvitationsByEmail(email: string) {
    return storage().query.accountInvitations.findMany({
        where: and(
            sql`lower(${accountInvitations.email}) = ${email.toLowerCase()}`,
            eq(accountInvitations.status, 'pending'),
            gt(accountInvitations.expiresAt, new Date()),
        ),
        with: {
            account: true,
            invitedByUser: true,
        },
    });
}

export async function createAccountInvitation(
    accountId: string,
    email: string,
    invitedByUserId: string,
) {
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    const result = await storage()
        .insert(accountInvitations)
        .values({
            accountId,
            email: email.toLowerCase(),
            token,
            invitedByUserId,
            expiresAt,
        })
        .returning();

    return result[0];
}

export async function cancelAccountInvitation(
    invitationId: number,
    accountId: string,
) {
    const result = await storage()
        .update(accountInvitations)
        .set({ status: 'cancelled' })
        .where(
            and(
                eq(accountInvitations.id, invitationId),
                eq(accountInvitations.accountId, accountId),
            ),
        )
        .returning();
    return result[0];
}

export async function acceptAccountInvitation(token: string, userId: string) {
    const invitation = await getAccountInvitationByToken(token);
    if (!invitation) {
        return null;
    }

    // Check if user is already a member of the account
    const existingMember = await storage().query.accountUsers.findFirst({
        where: and(
            eq(accountUsers.accountId, invitation.accountId),
            eq(accountUsers.userId, userId),
        ),
    });

    if (existingMember) {
        // User is already a member, just mark invitation as accepted
        await storage()
            .update(accountInvitations)
            .set({ status: 'accepted' })
            .where(eq(accountInvitations.id, invitation.id));
        return invitation;
    }

    // Add user to account
    await storage().insert(accountUsers).values({
        accountId: invitation.accountId,
        userId,
    });

    // Mark invitation as accepted
    await storage()
        .update(accountInvitations)
        .set({ status: 'accepted' })
        .where(eq(accountInvitations.id, invitation.id));

    return invitation;
}
