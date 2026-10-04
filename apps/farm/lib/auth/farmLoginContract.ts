export const FARM_LOGIN_ERROR_CODES = [
    'invalid_request',
    'invalid_credentials',
    'temporarily_locked',
    'email_verification_required',
    'no_farm_access',
    'service_unavailable',
] as const;

export type FarmLoginErrorCode = (typeof FARM_LOGIN_ERROR_CODES)[number];

export type FarmLoginCredentials = {
    email: string;
    password: string;
};

export type FarmLoginTokens = {
    token: string;
    refreshToken: string;
};

type FarmLoginSessionDependencies = {
    clearSession: () => Promise<void>;
    loadRefreshTokenSubject: (refreshToken: string) => Promise<string | null>;
    loadUser: (subject: string) => Promise<unknown>;
    persistSession: (tokens: FarmLoginTokens) => Promise<void>;
    revokeRefreshToken: (refreshToken: string) => Promise<void>;
    verifyAccessTokenSubject: (token: string) => Promise<string | null>;
};

export type FarmLoginSessionResult =
    | { ok: true }
    | { error: FarmLoginErrorCode };

const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 4096;
const MAX_TOKEN_LENGTH = 16_384;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function containsControlCharacter(value: string): boolean {
    for (const character of value) {
        const codePoint = character.codePointAt(0);
        if (codePoint !== undefined && (codePoint <= 31 || codePoint === 127)) {
            return true;
        }
    }

    return false;
}

function isToken(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= MAX_TOKEN_LENGTH &&
        value.trim() === value &&
        !/\s/u.test(value)
    );
}

export function getFarmLoginErrorCode(value: unknown): FarmLoginErrorCode {
    const candidate = isRecord(value) ? value.error : value;
    if (typeof candidate === 'string') {
        const error = FARM_LOGIN_ERROR_CODES.find(
            (knownError) => knownError === candidate,
        );
        if (error) {
            return error;
        }
    }

    return 'service_unavailable';
}

export function parseFarmLoginCredentials(
    value: unknown,
): FarmLoginCredentials | null {
    if (!isRecord(value)) {
        return null;
    }

    const { email: rawEmail, password } = value;
    if (typeof rawEmail !== 'string' || typeof password !== 'string') {
        return null;
    }

    const email = rawEmail.trim();
    if (
        email.length === 0 ||
        email.length > MAX_EMAIL_LENGTH ||
        containsControlCharacter(email) ||
        !EMAIL_PATTERN.test(email) ||
        password.length === 0 ||
        password.length > MAX_PASSWORD_LENGTH
    ) {
        return null;
    }

    return { email, password };
}

export function parseFarmLoginTokens(value: unknown): FarmLoginTokens | null {
    if (
        !isRecord(value) ||
        !isToken(value.token) ||
        !isToken(value.refreshToken)
    ) {
        return null;
    }

    return {
        token: value.token,
        refreshToken: value.refreshToken,
    };
}

export function getIssuedRefreshToken(value: unknown): string | null {
    if (!isRecord(value) || !isToken(value.refreshToken)) {
        return null;
    }

    return value.refreshToken;
}

export function mapTrustedLoginError(
    value: unknown,
    status: number,
): FarmLoginErrorCode {
    const upstreamCode = isRecord(value) ? value.errorCode : undefined;

    switch (upstreamCode) {
        case 'login_failed':
        case 'user_not_found':
        case 'invalid_credentials':
            return 'invalid_credentials';
        case 'user_blocked':
        case 'temporarily_locked':
            return 'temporarily_locked';
        case 'verify_email':
        case 'email_verification_required':
            return 'email_verification_required';
        case 'invalid_request':
            return 'invalid_request';
        default:
            break;
    }

    if (status === 400 || status === 422) {
        return 'invalid_request';
    }
    if (status === 401 || status === 404) {
        return 'invalid_credentials';
    }
    if (status === 429) {
        return 'temporarily_locked';
    }

    return 'service_unavailable';
}

export function getFarmLoginErrorStatus(error: FarmLoginErrorCode): number {
    switch (error) {
        case 'invalid_request':
            return 400;
        case 'invalid_credentials':
            return 401;
        case 'temporarily_locked':
            return 429;
        case 'email_verification_required':
        case 'no_farm_access':
            return 403;
        case 'service_unavailable':
            return 503;
    }
}

export function hasAuthorizedFarmLoginAccess(value: unknown): boolean {
    if (!isRecord(value) || !Array.isArray(value.accounts)) {
        return false;
    }

    return (
        (value.role === 'farmer' || value.role === 'admin') &&
        value.accounts.length > 0
    );
}

async function rejectIssuedSession(
    error: FarmLoginErrorCode,
    refreshToken: string,
    revokeRefreshToken: FarmLoginSessionDependencies['revokeRefreshToken'],
): Promise<FarmLoginSessionResult> {
    try {
        await revokeRefreshToken(refreshToken);
    } catch {
        // Authentication still fails closed if cleanup is temporarily unavailable.
    }
    return { error };
}

export async function establishFarmLoginSession(
    tokens: FarmLoginTokens,
    dependencies: FarmLoginSessionDependencies,
): Promise<FarmLoginSessionResult> {
    let subject: string | null;
    try {
        subject = await dependencies.verifyAccessTokenSubject(tokens.token);
    } catch {
        subject = null;
    }
    if (!subject) {
        return rejectIssuedSession(
            'service_unavailable',
            tokens.refreshToken,
            dependencies.revokeRefreshToken,
        );
    }

    let refreshTokenSubject: string | null;
    try {
        refreshTokenSubject = await dependencies.loadRefreshTokenSubject(
            tokens.refreshToken,
        );
    } catch {
        refreshTokenSubject = null;
    }
    if (!refreshTokenSubject || refreshTokenSubject !== subject) {
        return rejectIssuedSession(
            'service_unavailable',
            tokens.refreshToken,
            dependencies.revokeRefreshToken,
        );
    }

    let user: unknown;
    try {
        user = await dependencies.loadUser(subject);
    } catch {
        return rejectIssuedSession(
            'service_unavailable',
            tokens.refreshToken,
            dependencies.revokeRefreshToken,
        );
    }
    if (!hasAuthorizedFarmLoginAccess(user)) {
        return rejectIssuedSession(
            'no_farm_access',
            tokens.refreshToken,
            dependencies.revokeRefreshToken,
        );
    }

    try {
        await dependencies.persistSession(tokens);
    } catch {
        try {
            await dependencies.clearSession();
        } catch {
            // Authentication still fails closed if partial cleanup fails.
        }
        return rejectIssuedSession(
            'service_unavailable',
            tokens.refreshToken,
            dependencies.revokeRefreshToken,
        );
    }

    return { ok: true };
}
