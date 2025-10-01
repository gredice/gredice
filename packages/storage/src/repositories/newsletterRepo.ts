import 'server-only';

import { eq, isNotNull, isNull } from 'drizzle-orm';
import { storage } from '..';
import { newsletterSubscriptions, users } from '../schema';

export type NewsletterRecipientSource = 'subscriber' | 'user' | 'both';

export interface NewsletterRecipient {
    email: string;
    source: NewsletterRecipientSource;
}

export interface NewsletterAudienceSummary {
    total: number;
    subscriberCount: number;
    optedInUserCount: number;
    duplicateCount: number;
}

export interface NewsletterAudience extends NewsletterAudienceSummary {
    recipients: NewsletterRecipient[];
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string | null | undefined) {
    return (email ?? '').trim().toLowerCase();
}

function isEmailValid(email: string | null | undefined) {
    const normalized = normalizeEmail(email);
    if (!normalized) return false;
    return emailPattern.test(normalized);
}

export async function subscribeNewsletter(email: string, source?: string) {
    if (!isEmailValid(email)) {
        throw new Error('Invalid email provided for newsletter subscription');
    }

    const normalizedEmail = normalizeEmail(email);
    const existing = await storage().query.newsletterSubscriptions.findFirst({
        where: eq(newsletterSubscriptions.email, normalizedEmail),
    });
    const now = new Date();
    if (existing) {
        await storage()
            .update(newsletterSubscriptions)
            .set({
                source: source ?? existing.source,
                unsubscribedAt: null,
                updatedAt: now,
            })
            .where(eq(newsletterSubscriptions.id, existing.id));
        return existing.id;
    }

    await storage()
        .insert(newsletterSubscriptions)
        .values({
            email: normalizedEmail,
            source: source ?? null,
            createdAt: now,
            updatedAt: now,
        });
    return null;
}

export async function getNewsletterAudience(): Promise<NewsletterAudience> {
    const [subscriberRows, optedInUsers] = await Promise.all([
        storage().query.newsletterSubscriptions.findMany({
            columns: {
                email: newsletterSubscriptions.email,
            },
            where: isNull(newsletterSubscriptions.unsubscribedAt),
        }),
        storage().query.users.findMany({
            columns: {
                userName: users.userName,
            },
            where: isNotNull(users.newsletterOptedInAt),
        }),
    ]);

    const recipientsMap = new Map<
        string,
        { email: string; fromSubscriber: boolean; fromUser: boolean }
    >();

    for (const subscriber of subscriberRows) {
        const trimmed = (subscriber.email ?? '').trim();
        if (!isEmailValid(trimmed)) continue;
        const normalized = normalizeEmail(trimmed);
        const existing = recipientsMap.get(normalized);
        if (existing) {
            existing.fromSubscriber = true;
        } else {
            recipientsMap.set(normalized, {
                email: trimmed,
                fromSubscriber: true,
                fromUser: false,
            });
        }
    }

    for (const user of optedInUsers) {
        const trimmed = (user.userName ?? '').trim();
        if (!isEmailValid(trimmed)) continue;
        const normalized = normalizeEmail(trimmed);
        const existing = recipientsMap.get(normalized);
        if (existing) {
            existing.fromUser = true;
            if (!existing.email) {
                existing.email = trimmed;
            }
        } else {
            recipientsMap.set(normalized, {
                email: trimmed,
                fromSubscriber: false,
                fromUser: true,
            });
        }
    }

    const recipients: NewsletterRecipient[] = Array.from(
        recipientsMap.values(),
    ).map((entry) => ({
        email: entry.email,
        source:
            entry.fromSubscriber && entry.fromUser
                ? 'both'
                : entry.fromUser
                  ? 'user'
                  : 'subscriber',
    }));

    const duplicateCount = recipients.filter((r) => r.source === 'both').length;

    return {
        recipients,
        subscriberCount: subscriberRows.length,
        optedInUserCount: optedInUsers.length,
        duplicateCount,
        total: recipients.length,
    };
}

export async function getNewsletterAudienceSummary(): Promise<NewsletterAudienceSummary> {
    const { recipients: _recipients, ...summary } =
        await getNewsletterAudience();
    return summary;
}
