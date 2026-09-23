import 'server-only';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { userLogins, users } from '../schema';
import { storage } from '../storage';
import {
    isGeneratedUserDisplayName,
    randomUserDisplayName,
} from './userDisplayNames';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = StorageClient | TransactionClient;
export type LegacyDisplayNameScope = 'untouched' | 'all-social';
// Freeze the legacy cohort so a later apply cannot shorten new custom names.
const legacySignupCutoff = new Date('2026-09-23T20:06:16.000Z');

export function legacyDisplayNameChange(
    user: {
        displayName: string | null;
        createdAt: Date;
        updatedAt: Date;
        hasSocialLogin: boolean;
    },
    scope: LegacyDisplayNameScope,
): 'random' | 'first-name' | null {
    const name = user.displayName?.trim();
    if (!name || /\S+@\S+/u.test(name)) {
        return 'random';
    }
    if (!user.hasSocialLogin || isGeneratedUserDisplayName(name)) {
        return null;
    }
    if (
        scope === 'untouched' &&
        user.updatedAt.getTime() - user.createdAt.getTime() > 5000
    ) {
        return null;
    }
    return /\S+\s+\S+/u.test(name) ? 'first-name' : null;
}

async function findCandidates(
    db: DatabaseClient,
    scope: LegacyDisplayNameScope,
) {
    const [registeredUsers, socialLogins] = await Promise.all([
        db
            .select({
                id: users.id,
                displayName: users.displayName,
                createdAt: users.createdAt,
                updatedAt: users.updatedAt,
            })
            .from(users)
            .where(
                and(
                    eq(users.isTemporary, false),
                    lt(users.createdAt, legacySignupCutoff),
                ),
            ),
        db
            .select({ userId: userLogins.userId })
            .from(userLogins)
            .where(inArray(userLogins.loginType, ['google', 'facebook'])),
    ]);
    const socialUserIds = new Set(socialLogins.map((login) => login.userId));

    return registeredUsers.flatMap((user) => {
        const change = legacyDisplayNameChange(
            {
                ...user,
                hasSocialLogin: socialUserIds.has(user.id),
            },
            scope,
        );
        return change ? [{ ...user, change }] : [];
    });
}

export async function backfillLegacyUserDisplayNames({
    apply = false,
    scope = 'untouched',
}: {
    apply?: boolean;
    scope?: LegacyDisplayNameScope;
} = {}) {
    const run = async (db: DatabaseClient) => {
        const candidates = await findCandidates(db, scope);
        const summary = {
            scope,
            dryRun: !apply,
            randomCandidates: candidates.filter(
                (user) => user.change === 'random',
            ).length,
            firstNameCandidates: candidates.filter(
                (user) => user.change === 'first-name',
            ).length,
            updated: 0,
            skippedConcurrent: 0,
        };
        if (!apply) return summary;

        for (const user of candidates) {
            const displayName =
                user.change === 'random'
                    ? randomUserDisplayName()
                    : user.displayName?.trim().split(/\s+/u)[0];
            if (!displayName) continue;

            const updated = await db
                .update(users)
                .set({ displayName })
                .where(
                    and(
                        eq(users.id, user.id),
                        eq(users.updatedAt, user.updatedAt),
                        sql`${users.displayName} IS NOT DISTINCT FROM ${user.displayName}`,
                    ),
                )
                .returning({ id: users.id });
            if (updated.length === 1) summary.updated++;
            else summary.skippedConcurrent++;
        }
        return summary;
    };

    return apply ? storage().transaction(run) : run(storage());
}
