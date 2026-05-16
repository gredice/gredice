'use server';

import {
    createSocialAccount,
    type SocialAccountStatus,
    type SocialProvider,
    updateSocialAccount,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';
import { isSocialProvider } from '../../src/social/providers';

type SocialAccountActionErrorCode =
    | 'unauthorized'
    | 'invalid_payload'
    | 'internal_error';

export type SocialAccountActionState = {
    ok: boolean;
    errorCode?: SocialAccountActionErrorCode;
    message: string;
};

type NormalizedAccountPayload = {
    id: number | null;
    provider: string;
    providerAccountKey: string;
    label: string;
    handle: string;
    externalAccountId: string;
    defaultDestination: string;
    allowedDestinations: string[];
    credentialReference: string;
    status: string;
};

type ValidatedAccountPayload = Omit<
    NormalizedAccountPayload,
    'provider' | 'status'
> & {
    provider: SocialProvider;
    status: SocialAccountStatus;
};

function normalizeAccountPayload(formData: FormData): NormalizedAccountPayload {
    return {
        id: normalizeId(formData.get('id')),
        provider: normalizeTrimmed(formData.get('provider')).toLowerCase(),
        providerAccountKey: normalizeTrimmed(
            formData.get('providerAccountKey'),
        ),
        label: normalizeTrimmed(formData.get('label')),
        handle: normalizeTrimmed(formData.get('handle')),
        externalAccountId: normalizeTrimmed(formData.get('externalAccountId')),
        defaultDestination: normalizeTrimmed(
            formData.get('defaultDestination'),
        ),
        allowedDestinations: parseDestinationLines(
            formData.get('allowedDestinations'),
        ),
        credentialReference: normalizeTrimmed(
            formData.get('credentialReference'),
        ),
        status: normalizeTrimmed(formData.get('status')).toLowerCase(),
    };
}

function validateAccountPayload(
    payload: NormalizedAccountPayload,
):
    | { ok: true; payload: ValidatedAccountPayload }
    | { ok: false; state: SocialAccountActionState } {
    const {
        provider,
        providerAccountKey,
        label,
        status,
        defaultDestination,
        allowedDestinations,
    } = payload;

    if (!isSocialProvider(provider)) {
        return invalidPayload('Neispravan provider računa.');
    }
    if (!isSocialAccountStatus(status)) {
        return invalidPayload('Neispravan status računa.');
    }
    if (!providerAccountKey) {
        return invalidPayload('Ključ provider računa je obavezan.');
    }
    if (!/^[a-z0-9:_-]+$/i.test(providerAccountKey)) {
        return invalidPayload(
            'Ključ provider računa smije sadržavati slova, brojeve, :, _ i -.',
        );
    }
    if (!label) {
        return invalidPayload('Naziv računa je obavezan.');
    }
    if (!defaultDestination && allowedDestinations.length === 0) {
        return invalidPayload(
            'Unesite zadano odredište ili barem jedno dopušteno odredište.',
        );
    }

    return {
        ok: true,
        payload: {
            ...payload,
            provider,
            status,
        },
    };
}

export const __testUtils = {
    normalizeAccountPayload,
    validateAccountPayload,
};

export async function saveSocialAccountAction(
    _prevState: SocialAccountActionState | null,
    formData: FormData,
): Promise<SocialAccountActionState> {
    try {
        await auth(['admin']);
    } catch {
        return {
            ok: false,
            errorCode: 'unauthorized',
            message: 'Niste ovlašteni za upravljanje društvenim računima.',
        };
    }

    const normalizedPayload = normalizeAccountPayload(formData);
    const validation = validateAccountPayload(normalizedPayload);
    if (!validation.ok) return validation.state;

    const payload = validation.payload;

    try {
        if (payload.id) {
            const updated = await updateSocialAccount({
                id: payload.id,
                label: payload.label,
                handle: payload.handle || null,
                externalAccountId: payload.externalAccountId || null,
                status: payload.status,
                defaultDestination: payload.defaultDestination || null,
                allowedDestinations: payload.allowedDestinations,
                credentialReference: payload.credentialReference || null,
                providerMetadata: {
                    managedBy: 'admin-social-publishing',
                },
            });
            if (!updated) {
                return {
                    ok: false,
                    errorCode: 'invalid_payload',
                    message: 'Društveni račun nije pronađen.',
                };
            }
        } else {
            await createSocialAccount({
                provider: payload.provider,
                providerAccountKey: payload.providerAccountKey,
                label: payload.label,
                handle: payload.handle || null,
                externalAccountId: payload.externalAccountId || null,
                status: payload.status,
                defaultDestination: payload.defaultDestination || null,
                allowedDestinations: payload.allowedDestinations,
                credentialReference: payload.credentialReference || null,
                providerMetadata: {
                    managedBy: 'admin-social-publishing',
                },
            });
        }

        revalidatePath(KnownPages.SocialPublishing);
        return {
            ok: true,
            message: payload.id
                ? 'Društveni račun je ažuriran.'
                : 'Društveni račun je dodan.',
        };
    } catch {
        return {
            ok: false,
            errorCode: 'internal_error',
            message:
                'Društveni račun nije spremljen. Provjerite je li ključ već zauzet.',
        };
    }
}

function invalidPayload(message: string): {
    ok: false;
    state: SocialAccountActionState;
} {
    return {
        ok: false,
        state: {
            ok: false,
            errorCode: 'invalid_payload',
            message,
        },
    };
}

function normalizeTrimmed(value: FormDataEntryValue | null): string {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeId(value: FormDataEntryValue | null): number | null {
    const normalized = normalizeTrimmed(value);
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseDestinationLines(value: FormDataEntryValue | null): string[] {
    return normalizeTrimmed(value)
        .split(/\r?\n|,/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function isSocialAccountStatus(status: string): status is SocialAccountStatus {
    return (
        status === 'active' ||
        status === 'disabled' ||
        status === 'needs_reauth'
    );
}
