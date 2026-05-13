'use server';

import {
    createSocialPost,
    type SocialPostType,
    type SocialProvider,
    updateSocialPostStatus,
} from '@gredice/storage';
import { auth } from '../../lib/auth/auth';
import { createSocialProviderAdapter } from '../../src/social/providers';

const TITLE_MAX_LENGTH = 300;
const BODY_MAX_LENGTH = 40000;
const SUBMISSION_TOKEN_MIN_LENGTH = 12;
const duplicateSubmissionKeys = new Map<string, number>();

type ActionErrorCode =
    | 'unauthorized'
    | 'invalid_payload'
    | 'duplicate_submission'
    | 'provider_error'
    | 'internal_error';

export type PublishSocialPostState = {
    ok: boolean;
    errorCode?: ActionErrorCode;
    message: string;
    socialPostId?: number;
    status?: 'submitted' | 'published' | 'failed';
    providerPermalink?: string | null;
};

function normalizeTrimmed(value: FormDataEntryValue | null): string {
    return typeof value === 'string' ? value.trim() : '';
}

function cleanupSubmissionKeyCache(now: number): void {
    for (const [key, expiresAt] of duplicateSubmissionKeys) {
        if (expiresAt <= now) {
            duplicateSubmissionKeys.delete(key);
        }
    }
}

function isValidPostType(postType: string): postType is SocialPostType {
    return ['text', 'link', 'image', 'video', 'other'].includes(postType);
}

function isValidProvider(provider: string): provider is SocialProvider {
    return provider === 'reddit';
}

function sanitizeProviderErrorDetails(
    details: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
    if (!details) return null;
    const safeKeys = new Set(['status', 'providerErrorId', 'reason']);
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(details)) {
        if (safeKeys.has(key)) {
            sanitized[key] = value;
        }
    }
    return Object.keys(sanitized).length ? sanitized : null;
}

export async function publishSocialPostAction(
    _prevState: PublishSocialPostState | null,
    formData: FormData,
): Promise<PublishSocialPostState> {
    try {
        await auth(['admin']);
    } catch {
        return {
            ok: false,
            errorCode: 'unauthorized',
            message: 'Niste ovlašteni za objavu društvenih objava.',
        };
    }

    const provider = normalizeTrimmed(formData.get('provider')).toLowerCase();
    const providerAccountKey = normalizeTrimmed(
        formData.get('providerAccountKey'),
    );
    const destination = normalizeTrimmed(formData.get('destination')).replace(
        /^r\//i,
        '',
    );
    const postType = normalizeTrimmed(formData.get('postType')).toLowerCase();
    const title = normalizeTrimmed(formData.get('title'));
    const body = normalizeTrimmed(formData.get('body'));
    const url = normalizeTrimmed(formData.get('url'));
    const submissionToken = normalizeTrimmed(formData.get('submissionToken'));

    if (!isValidProvider(provider) || !isValidPostType(postType)) {
        return {
            ok: false,
            errorCode: 'invalid_payload',
            message: 'Neispravan provider ili tip objave.',
        };
    }
    if (!providerAccountKey) {
        return {
            ok: false,
            errorCode: 'invalid_payload',
            message: 'Nedostaje ključ provider računa.',
        };
    }
    if (!destination) {
        return {
            ok: false,
            errorCode: 'invalid_payload',
            message: 'Odredište je obavezno.',
        };
    }
    if (!title || title.length > TITLE_MAX_LENGTH) {
        return {
            ok: false,
            errorCode: 'invalid_payload',
            message: 'Naslov je obavezan i mora imati najviše 300 znakova.',
        };
    }
    if (url) {
        try {
            const parsed = new URL(url);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                throw new Error('invalid protocol');
            }
        } catch {
            return {
                ok: false,
                errorCode: 'invalid_payload',
                message: 'Link mora biti valjani http ili https URL.',
            };
        }
    }
    if (!url && !body) {
        return {
            ok: false,
            errorCode: 'invalid_payload',
            message: 'Potrebno je unijeti sadržaj objave ili link.',
        };
    }
    if (body.length > BODY_MAX_LENGTH) {
        return {
            ok: false,
            errorCode: 'invalid_payload',
            message: 'Sadržaj objave je predugačak.',
        };
    }
    if (submissionToken.length < SUBMISSION_TOKEN_MIN_LENGTH) {
        return {
            ok: false,
            errorCode: 'invalid_payload',
            message: 'Nedostaje valjan token prijave obrasca.',
        };
    }

    const now = Date.now();
    cleanupSubmissionKeyCache(now);
    if (duplicateSubmissionKeys.has(submissionToken)) {
        return {
            ok: false,
            errorCode: 'duplicate_submission',
            message:
                'Objava je već poslana. Pričekajte prije ponovnog pokušaja.',
        };
    }
    duplicateSubmissionKeys.set(submissionToken, now + 5 * 60_000);

    const adapter = createSocialProviderAdapter(provider);
    const configError = adapter.validateConfig();
    if (configError) {
        return {
            ok: false,
            errorCode: 'provider_error',
            message: configError.message,
        };
    }

    const created = await createSocialPost({
        provider,
        providerAccountKey,
        destination,
        postType,
        title,
        body: body || null,
        url: url || null,
        providerMetadata: {
            requestedBy: 'admin-action',
        },
    });

    await updateSocialPostStatus({ id: created.id, status: 'submitting' });

    const providerResult = await adapter.publishPost({
        title,
        body: body || undefined,
        url: url || undefined,
        destination,
    });

    if (!providerResult.ok) {
        await updateSocialPostStatus({
            id: created.id,
            status: 'failed',
            failureCode: providerResult.code,
            failureMessage: providerResult.message,
            failureMetadata: sanitizeProviderErrorDetails(
                providerResult.details,
            ),
        });

        return {
            ok: false,
            errorCode: 'provider_error',
            message: providerResult.message,
            socialPostId: created.id,
            status: 'failed',
        };
    }

    const finalStatus = providerResult.permalink ? 'published' : 'submitted';
    await updateSocialPostStatus({
        id: created.id,
        status: finalStatus,
        providerSubmissionId: providerResult.providerPostId,
        providerPermalink: providerResult.permalink,
        providerMetadata: providerResult.metadata ?? null,
    });

    return {
        ok: true,
        message: 'Objava je uspješno poslana.',
        socialPostId: created.id,
        status: finalStatus,
        providerPermalink: providerResult.permalink,
    };
}
