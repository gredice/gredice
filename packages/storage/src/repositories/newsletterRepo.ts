import 'server-only';

import { eq } from 'drizzle-orm';
import { storage } from '..';
import {
    type NewsletterStatus,
    newsletterSubscribers,
    type SelectNewsletterSubscriber,
} from '../schema';

export type CreateNewsletterSubscription = {
    email: string;
    source?: string;
};

export async function subscribeToNewsletter(
    subscription: CreateNewsletterSubscription,
): Promise<SelectNewsletterSubscriber> {
    const normalizedEmail = subscription.email.toLowerCase().trim();

    // Check if already exists
    const existing = await storage()
        .select()
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.email, normalizedEmail))
        .limit(1);

    if (existing.length > 0) {
        const existingSubscriber = existing[0];
        // If unsubscribed, resubscribe
        if (
            existingSubscriber &&
            existingSubscriber.status === 'unsubscribed'
        ) {
            const [updated] = await storage()
                .update(newsletterSubscribers)
                .set({
                    status: 'subscribed',
                    subscribedAt: new Date(),
                    unsubscribedAt: null,
                })
                .where(eq(newsletterSubscribers.id, existingSubscriber.id))
                .returning();

            if (!updated) {
                throw new Error('Failed to resubscribe to newsletter');
            }
            return updated;
        }
        // Already subscribed
        return existingSubscriber as SelectNewsletterSubscriber;
    }

    // Create new subscription
    const [created] = await storage()
        .insert(newsletterSubscribers)
        .values({
            email: normalizedEmail,
            source: subscription.source ?? null,
        })
        .returning();

    if (!created) {
        throw new Error('Failed to subscribe to newsletter');
    }
    return created;
}

export async function unsubscribeFromNewsletter(
    email: string,
): Promise<SelectNewsletterSubscriber | null> {
    const normalizedEmail = email.toLowerCase().trim();

    const [updated] = await storage()
        .update(newsletterSubscribers)
        .set({
            status: 'unsubscribed',
            unsubscribedAt: new Date(),
        })
        .where(eq(newsletterSubscribers.email, normalizedEmail))
        .returning();

    return updated ?? null;
}

export async function getNewsletterSubscriber(
    email: string,
): Promise<SelectNewsletterSubscriber | null> {
    const normalizedEmail = email.toLowerCase().trim();

    const [subscriber] = await storage()
        .select()
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.email, normalizedEmail))
        .limit(1);

    return subscriber ?? null;
}

export async function getNewsletterSubscribersByStatus(
    status: NewsletterStatus,
): Promise<SelectNewsletterSubscriber[]> {
    return storage()
        .select()
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.status, status));
}

export async function getAllActiveNewsletterSubscribers(): Promise<
    SelectNewsletterSubscriber[]
> {
    return getNewsletterSubscribersByStatus('subscribed');
}
