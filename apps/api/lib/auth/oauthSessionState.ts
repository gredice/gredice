import { randomUUID } from 'node:crypto';
import { createOAuthStateJwt, verifyAccessJwt } from './auth';

export async function createOAuthStateFromSession(sessionToken?: string) {
    if (sessionToken) {
        const verified = await verifyAccessJwt(sessionToken);
        const userId = verified.result?.payload.sub;
        if (
            !verified.error &&
            typeof userId === 'string' &&
            userId.length > 0
        ) {
            return createOAuthStateJwt(userId);
        }
    }
    return randomUUID().replaceAll('-', '');
}
