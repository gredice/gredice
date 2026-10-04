'use server';

import {
    createSocialPost,
    getSocialAccountByProviderKey,
    type SocialPostMediaUrl,
    type SocialPostStatus,
    type SocialPostType,
    type SocialProvider,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';
import {
    getSocialProviderDefinition,
    isPostTypeSupportedByProvider,
    isSocialPostType,
    isSocialProvider,
} from '../../src/social/providers';
import {
    processReadySocialPosts,
    sanitizeProviderErrorDetails,
    submitSocialPost,
} from '../../src/social/socialPublishingQueue';

const TITLE_MAX_LENGTH = 300;
const BODY_MAX_LENGTH = 40000;
const SUBMISSION_TOKEN_MIN_LENGTH = 12;
const SOCIAL_QUEUE_BATCH_LIMIT = 20;
const duplicateSubmissionKeys = new Map<string, number>();

type ActionErrorCode =
    | 'unauthorized'
    | 'invalid_payload'
    | 'duplicate_submission'
    | 'provider_error'
    | 'internal_error';

type SubmissionIntent = 'publish' | 'queue' | 'schedule';

export type PublishSocialPostState = {
    ok: boolean;
    errorCode?: ActionErrorCode;
    message: string;
    socialPostId?: number;
    status?: SocialPostStatus;
    providerPermalink?: string | null;
};

export type ProcessSocialQueueState = {
    ok: boolean;
    errorCode?: ActionErrorCode;
    message: string;
    processed: number;
    failed: number;
};

type NormalizedPayload = {
    provider: string;
    providerAccountKey: string;
    destination: string;
    postType: string;
    title: string;
    body: string;
    url: string;
    mediaUrls: string[];
    scheduledAt: string;
    submissionToken: string;
    intent: string;
};

type ValidatedPayload = Omit<
    NormalizedPayload,
    'provider' | 'postType' | 'mediaUrls' | 'intent'
> & {
    provider: SocialProvider;
    postType: SocialPostType;
    mediaUrls: SocialPostMediaUrl[];
    scheduledAtDate: Date | null;
    intent: SubmissionIntent;
};

function normalizePayload(formData: FormData): NormalizedPayload {
    return {
        provider: normalizeTrimmed(formData.get('provider')).toLowerCase(),
        providerAccountKey: normalizeTrimmed(
            formData.get('providerAccountKey'),
        ),
        destination: normalizeTrimmed(formData.get('destination')).replace(
            /^r\//i,
            '',
        ),
        postType: normalizeTrimmed(formData.get('postType')).toLowerCase(),
        title: normalizeTrimmed(formData.get('title')),
        body: normalizeTrimmed(formData.get('body')),
        url: normalizeTrimmed(formData.get('url')),
        mediaUrls: parseMediaUrlLines(formData.get('mediaUrls')),
        scheduledAt: normalizeTrimmed(formData.get('scheduledAt')),
        submissionToken: normalizeTrimmed(formData.get('submissionToken')),
        intent: normalizeTrimmed(formData.get('intent')).toLowerCase(),
    };
}

function validatePayload(
    payload: NormalizedPayload,
    now = new Date(),
):
    | { ok: true; payload: ValidatedPayload }
    | { ok: false; state: PublishSocialPostState } {
    const {
        provider,
        providerAccountKey,
        destination,
        postType,
        title,
        body,
        url,
        mediaUrls,
        scheduledAt,
        submissionToken,
        intent,
    } = payload;

    if (
        !isSocialProvider(provider) ||
        !isSocialPostType(postType) ||
        !isSubmissionIntent(intent)
    ) {
        return invalidPayload('Neispravan provider, tip objave ili akcija.');
    }

    const definition = getSocialProviderDefinition(provider);
    if (!definition) {
        return invalidPayload('Provider nije podržan.');
    }
    if (!isPostTypeSupportedByProvider(provider, postType)) {
        return invalidPayload('Odabrani provider ne podržava taj tip objave.');
    }
    if (!providerAccountKey) {
        return invalidPayload('Nedostaje ključ provider računa.');
    }
    if (!destination) {
        return invalidPayload('Odredište je obavezno.');
    }
    if (title.length > TITLE_MAX_LENGTH) {
        return invalidPayload('Naslov mora imati najviše 300 znakova.');
    }
    if (definition.requiresTitle && !title) {
        return invalidPayload('Naslov je obavezan za odabrani provider.');
    }
    if (body.length > BODY_MAX_LENGTH) {
        return invalidPayload('Sadržaj objave je predugačak.');
    }
    if (url && !isHttpUrl(url)) {
        return invalidPayload('Link mora biti valjani http ili https URL.');
    }
    if (postType === 'link' && !url) {
        return invalidPayload('Link objava mora imati URL.');
    }

    const requiresMedia =
        definition.requiresMedia ||
        postType === 'image' ||
        postType === 'video' ||
        postType === 'reel' ||
        postType === 'story' ||
        postType === 'carousel';
    if (requiresMedia && mediaUrls.length === 0) {
        return invalidPayload(
            'Za ovaj tip objave potreban je barem jedan medij.',
        );
    }

    const parsedMediaUrls: SocialPostMediaUrl[] = [];
    for (const mediaUrl of mediaUrls) {
        if (!isHttpUrl(mediaUrl)) {
            return invalidPayload(
                'Svaki medij mora biti valjani http ili https URL.',
            );
        }
        parsedMediaUrls.push({
            url: mediaUrl,
            type: inferMediaType(mediaUrl),
        });
    }
    const mediaValidationMessage = validateMediaForPostType(
        postType,
        parsedMediaUrls,
    );
    if (mediaValidationMessage) {
        return invalidPayload(mediaValidationMessage);
    }

    if (!title && !body && !url && parsedMediaUrls.length === 0) {
        return invalidPayload('Potrebno je unijeti sadržaj, link ili medij.');
    }
    if (submissionToken.length < SUBMISSION_TOKEN_MIN_LENGTH) {
        return invalidPayload('Nedostaje valjan token prijave obrasca.');
    }

    const scheduledAtDate = parseScheduledAt(scheduledAt);
    if (intent === 'schedule') {
        if (!scheduledAtDate) {
            return invalidPayload('Zakazana objava mora imati valjani datum.');
        }
        if (scheduledAtDate.getTime() <= now.getTime()) {
            return invalidPayload('Zakazano vrijeme mora biti u budućnosti.');
        }
    }

    return {
        ok: true,
        payload: {
            ...payload,
            provider,
            postType,
            mediaUrls: parsedMediaUrls,
            scheduledAtDate,
            intent,
        },
    };
}

export const __testUtils = {
    normalizePayload,
    validatePayload,
    sanitizeProviderErrorDetails,
};

function invalidPayload(message: string): {
    ok: false;
    state: PublishSocialPostState;
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

function parseMediaUrlLines(value: FormDataEntryValue | null): string[] {
    return normalizeTrimmed(value)
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function cleanupSubmissionKeyCache(now: number): void {
    for (const [key, expiresAt] of duplicateSubmissionKeys) {
        if (expiresAt <= now) {
            duplicateSubmissionKeys.delete(key);
        }
    }
}

function isSubmissionIntent(intent: string): intent is SubmissionIntent {
    return intent === 'publish' || intent === 'queue' || intent === 'schedule';
}

function isHttpUrl(value: string): boolean {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function parseScheduledAt(value: string): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function inferMediaType(url: string): SocialPostMediaUrl['type'] {
    const pathname = new URL(url).pathname.toLowerCase();
    if (/\.(mp4|mov|m4v|webm)$/.test(pathname)) return 'video';
    return 'image';
}

function validateMediaForPostType(
    postType: SocialPostType,
    mediaUrls: SocialPostMediaUrl[],
): string | null {
    if (postType === 'image' && !mediaUrls.every(isImageMedia)) {
        return 'Slika objava smije sadržavati samo slike.';
    }
    if (postType === 'video' && !mediaUrls.every(isVideoMedia)) {
        return 'Video objava smije sadržavati samo video medije.';
    }
    if (postType === 'reel') {
        if (mediaUrls.length !== 1 || !mediaUrls.every(isVideoMedia)) {
            return 'Reel objava mora sadržavati točno jedan video.';
        }
    }
    if (postType === 'carousel' && mediaUrls.length < 2) {
        return 'Carousel objava mora sadržavati barem dva medija.';
    }

    return null;
}

function isImageMedia(mediaUrl: SocialPostMediaUrl) {
    return mediaUrl.type === 'image';
}

function isVideoMedia(mediaUrl: SocialPostMediaUrl) {
    return mediaUrl.type === 'video';
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

    const normalizedPayload = normalizePayload(formData);
    const payloadValidation = validatePayload(normalizedPayload);
    if (!payloadValidation.ok) {
        return payloadValidation.state;
    }

    const payload = payloadValidation.payload;
    const accountValidation = await validateManagedAccount(payload);
    if (accountValidation) return accountValidation;

    const duplicateState = reserveSubmissionToken(payload.submissionToken);
    if (duplicateState) return duplicateState;

    try {
        const created = await createSocialPost({
            provider: payload.provider,
            providerAccountKey: payload.providerAccountKey,
            destination: payload.destination,
            status: statusForIntent(payload.intent),
            postType: payload.postType,
            title: payload.title || null,
            body: payload.body || null,
            url: payload.url || null,
            mediaUrls: payload.mediaUrls,
            scheduledAt: payload.scheduledAtDate,
            providerMetadata: {
                requestedBy: 'admin-action',
                submissionIntent: payload.intent,
            },
        });

        if (payload.intent === 'publish') {
            const result = await submitSocialPost(created);
            revalidatePath(KnownPages.SocialPublishing);
            return result;
        }

        revalidatePath(KnownPages.SocialPublishing);
        return {
            ok: true,
            message:
                payload.intent === 'schedule'
                    ? 'Objava je zakazana.'
                    : 'Objava je dodana u red.',
            socialPostId: created.id,
            status: created.status,
        };
    } catch {
        duplicateSubmissionKeys.delete(payload.submissionToken);
        return {
            ok: false,
            errorCode: 'internal_error',
            message: 'Objava nije spremljena zbog neočekivane greške.',
            status: 'failed',
        };
    }
}

export async function processSocialPublishingQueueAction(
    _prevState: ProcessSocialQueueState | null,
    _formData: FormData,
): Promise<ProcessSocialQueueState> {
    try {
        await auth(['admin']);
    } catch {
        return {
            ok: false,
            errorCode: 'unauthorized',
            message: 'Niste ovlašteni za obradu reda društvenih objava.',
            processed: 0,
            failed: 0,
        };
    }

    const result = await processReadySocialPosts({
        limit: SOCIAL_QUEUE_BATCH_LIMIT,
    });

    revalidatePath(KnownPages.SocialPublishing);
    return {
        ok: result.failed === 0,
        errorCode: result.failed ? 'provider_error' : undefined,
        message:
            result.processed === 0
                ? 'Nema objava spremnih za slanje.'
                : `Obrađeno objava: ${result.processed}. Neuspjelo: ${result.failed}.`,
        processed: result.processed,
        failed: result.failed,
    };
}

function reserveSubmissionToken(
    submissionToken: string,
): PublishSocialPostState | null {
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
    return null;
}

function statusForIntent(intent: SubmissionIntent): SocialPostStatus {
    if (intent === 'queue') return 'queued';
    if (intent === 'schedule') return 'scheduled';
    return 'created';
}

async function validateManagedAccount(
    payload: ValidatedPayload,
): Promise<PublishSocialPostState | null> {
    const account = await getSocialAccountByProviderKey({
        provider: payload.provider,
        providerAccountKey: payload.providerAccountKey,
    });
    if (!account) return null;
    if (account.status !== 'active') {
        return {
            ok: false,
            errorCode: 'invalid_payload',
            message: 'Odabrani društveni račun nije aktivan.',
        };
    }

    const allowedDestinations = normalizeAccountDestinations(
        account.allowedDestinations,
    );
    if (
        allowedDestinations.length > 0 &&
        !allowedDestinations.includes(payload.destination)
    ) {
        return {
            ok: false,
            errorCode: 'invalid_payload',
            message: 'Odredište nije dopušteno za odabrani društveni račun.',
        };
    }

    return null;
}

function normalizeAccountDestinations(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((entry) => typeof entry === 'string');
}
