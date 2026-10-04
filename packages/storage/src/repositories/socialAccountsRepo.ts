import 'server-only';

import { and, asc, eq } from 'drizzle-orm';
import { storage } from '..';
import {
    type SelectSocialAccount,
    type SocialAccountStatus,
    type SocialProvider,
    socialAccounts,
} from '../schema';

type JsonObject = Record<string, unknown>;

export type CreateSocialAccountInput = {
    provider: SocialProvider;
    providerAccountKey: string;
    label: string;
    handle?: string | null;
    externalAccountId?: string | null;
    status?: SocialAccountStatus;
    defaultDestination?: string | null;
    allowedDestinations?: string[] | null;
    credentialReference?: string | null;
    providerMetadata?: JsonObject | null;
};

export type UpdateSocialAccountInput = {
    id: number;
    label?: string;
    handle?: string | null;
    externalAccountId?: string | null;
    status?: SocialAccountStatus;
    defaultDestination?: string | null;
    allowedDestinations?: string[] | null;
    credentialReference?: string | null;
    providerMetadata?: JsonObject | null;
};

export async function createSocialAccount(
    input: CreateSocialAccountInput,
): Promise<SelectSocialAccount> {
    const [created] = await storage()
        .insert(socialAccounts)
        .values({
            provider: input.provider,
            providerAccountKey: input.providerAccountKey,
            label: input.label,
            handle: input.handle ?? null,
            externalAccountId: input.externalAccountId ?? null,
            status: input.status ?? 'active',
            defaultDestination: input.defaultDestination ?? null,
            allowedDestinations: input.allowedDestinations ?? null,
            credentialReference: input.credentialReference ?? null,
            providerMetadata: input.providerMetadata ?? null,
        })
        .returning();

    if (!created) {
        throw new Error('Failed to create social account');
    }

    return created;
}

export async function updateSocialAccount(
    input: UpdateSocialAccountInput,
): Promise<SelectSocialAccount | null> {
    const [updated] = await storage()
        .update(socialAccounts)
        .set({
            label: input.label,
            handle: input.handle,
            externalAccountId: input.externalAccountId,
            status: input.status,
            defaultDestination: input.defaultDestination,
            allowedDestinations: input.allowedDestinations,
            credentialReference: input.credentialReference,
            providerMetadata: input.providerMetadata,
            updatedAt: new Date(),
        })
        .where(eq(socialAccounts.id, input.id))
        .returning();

    return updated ?? null;
}

export async function getSocialAccount(
    id: number,
): Promise<SelectSocialAccount | null> {
    const [account] = await storage()
        .select()
        .from(socialAccounts)
        .where(eq(socialAccounts.id, id))
        .limit(1);

    return account ?? null;
}

export async function getSocialAccountByProviderKey({
    provider,
    providerAccountKey,
}: {
    provider: SocialProvider;
    providerAccountKey: string;
}): Promise<SelectSocialAccount | null> {
    const [account] = await storage()
        .select()
        .from(socialAccounts)
        .where(
            and(
                eq(socialAccounts.provider, provider),
                eq(socialAccounts.providerAccountKey, providerAccountKey),
            ),
        )
        .limit(1);

    return account ?? null;
}

export async function listSocialAccounts(filters?: {
    provider?: SocialProvider;
    status?: SocialAccountStatus;
}): Promise<SelectSocialAccount[]> {
    const whereClause = and(
        filters?.provider
            ? eq(socialAccounts.provider, filters.provider)
            : undefined,
        filters?.status ? eq(socialAccounts.status, filters.status) : undefined,
    );

    return storage()
        .select()
        .from(socialAccounts)
        .where(whereClause)
        .orderBy(asc(socialAccounts.provider), asc(socialAccounts.label));
}
