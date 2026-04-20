const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USER_PUBLIC_ID_PREFIX = 'u_';

function assertUuid(value: string) {
    if (!UUID_REGEX.test(value)) {
        throw new Error('Invalid user id format');
    }
}

export function userIdToPublicId(userId: string): string {
    assertUuid(userId);
    const hex = userId.replaceAll('-', '');
    const encoded = Buffer.from(hex, 'hex').toString('base64url');
    return `${USER_PUBLIC_ID_PREFIX}${encoded}`;
}

export function publicIdToUserId(publicId: string): string | null {
    if (!publicId.startsWith(USER_PUBLIC_ID_PREFIX)) {
        return null;
    }

    const encoded = publicId.slice(USER_PUBLIC_ID_PREFIX.length);
    if (encoded.length <= 0) {
        return null;
    }

    try {
        const hex = Buffer.from(encoded, 'base64url').toString('hex');
        if (hex.length !== 32) {
            return null;
        }

        const userId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
        return UUID_REGEX.test(userId) ? userId : null;
    } catch {
        return null;
    }
}
