import { createHmac, timingSafeEqual } from 'node:crypto';

export const PUBLIC_OG_SIGNATURE_PARAMETER = 'sig';

const publicOgSignatureDomain = 'gredice:public-og-card:v1';
const signaturePattern = /^[A-Za-z0-9_-]{43}$/;

export type PublicOgSigningConfig = {
    secret?: string;
    allowUnsigned: boolean;
    configurationValid: boolean;
};

type PublicOgSigningEnvironment = {
    CMS_PAGES_PREVIEW_SECRET?: string;
    VERCEL_ENV?: string;
    NODE_ENV?: string;
    CI?: string;
};

export type PublicOgSignatureVerification =
    | 'valid'
    | 'unsigned-local'
    | 'configuration-error'
    | 'missing-signature'
    | 'invalid-signature'
    | 'noncanonical-query';

function environmentFlag(value: string | undefined) {
    return Boolean(value && value !== '0' && value !== 'false');
}

export function resolvePublicOgSigningConfig(
    environment: PublicOgSigningEnvironment = process.env,
): PublicOgSigningConfig {
    const secret = environment.CMS_PAGES_PREVIEW_SECRET?.trim();
    if (secret) {
        return {
            secret,
            allowUnsigned: false,
            configurationValid: true,
        };
    }

    const vercelEnvironment = environment.VERCEL_ENV?.trim();
    const isVercelDeployment =
        vercelEnvironment === 'preview' || vercelEnvironment === 'production';
    const isCi = environmentFlag(environment.CI);
    const isLocalOrTest =
        environment.NODE_ENV === 'test' ||
        vercelEnvironment === 'development' ||
        (!vercelEnvironment && !isCi);
    const allowUnsigned = isLocalOrTest && !isCi && !isVercelDeployment;

    return {
        allowUnsigned,
        configurationValid: allowUnsigned,
    };
}

export function signPublicOgCanonicalQuery(
    canonicalQuery: string,
    secret: string,
) {
    return createHmac('sha256', secret)
        .update(publicOgSignatureDomain)
        .update('\0')
        .update(canonicalQuery)
        .digest('base64url');
}

export function addPublicOgSignature(
    canonicalSearchParams: URLSearchParams,
    config: PublicOgSigningConfig = resolvePublicOgSigningConfig(),
) {
    if (!config.configurationValid) {
        throw new Error(
            'CMS_PAGES_PREVIEW_SECRET is required to sign public Open Graph cards in this environment.',
        );
    }

    const signed = new URLSearchParams(canonicalSearchParams);
    if (config.secret) {
        signed.set(
            PUBLIC_OG_SIGNATURE_PARAMETER,
            signPublicOgCanonicalQuery(
                canonicalSearchParams.toString(),
                config.secret,
            ),
        );
    } else if (!config.allowUnsigned) {
        throw new Error('Unsigned public Open Graph cards are not allowed.');
    }

    return signed;
}

function signatureMatches(
    canonicalQuery: string,
    signature: string,
    secret: string,
) {
    if (!signaturePattern.test(signature)) {
        return false;
    }

    const expected = createHmac('sha256', secret)
        .update(publicOgSignatureDomain)
        .update('\0')
        .update(canonicalQuery)
        .digest();
    const actual = Buffer.from(signature, 'base64url');

    return (
        actual.length === expected.length && timingSafeEqual(actual, expected)
    );
}

export function verifyPublicOgSignature(
    receivedSearchParams: URLSearchParams,
    canonicalSearchParams: URLSearchParams,
    config: PublicOgSigningConfig = resolvePublicOgSigningConfig(),
): PublicOgSignatureVerification {
    if (!config.configurationValid) {
        return 'configuration-error';
    }

    const receivedEntries = Array.from(receivedSearchParams.entries());
    const signature = receivedSearchParams.get(PUBLIC_OG_SIGNATURE_PARAMETER);
    const unsignedReceived = new URLSearchParams(
        receivedEntries.filter(
            ([key]) => key !== PUBLIC_OG_SIGNATURE_PARAMETER,
        ),
    );

    if (unsignedReceived.toString() !== canonicalSearchParams.toString()) {
        return 'noncanonical-query';
    }

    if (!config.secret) {
        return !signature && config.allowUnsigned
            ? 'unsigned-local'
            : 'invalid-signature';
    }

    if (!signature) {
        return 'missing-signature';
    }

    if (receivedEntries.at(-1)?.[0] !== PUBLIC_OG_SIGNATURE_PARAMETER) {
        return 'noncanonical-query';
    }

    return signatureMatches(
        canonicalSearchParams.toString(),
        signature,
        config.secret,
    )
        ? 'valid'
        : 'invalid-signature';
}
