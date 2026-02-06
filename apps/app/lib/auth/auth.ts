import 'server-only';
import {
    baseAuth,
    baseWithAuth,
    clearCookie,
    createJwt,
    setCookie,
    verifyJwt,
} from './baseAuth';
import { refreshSessionIfNeeded } from './sessionRefresh';

export { clearCookie, createJwt, setCookie, verifyJwt };

export async function auth(...args: Parameters<typeof baseAuth>) {
    await refreshSessionIfNeeded();
    return await baseAuth(...args);
}

export async function withAuth(...args: Parameters<typeof baseWithAuth>) {
    await refreshSessionIfNeeded();
    return await baseWithAuth(...args);
}
