import type { Context } from 'hono';
import { auth } from '../auth/auth';

export type AuthVariables = {
    authContext: Awaited<ReturnType<typeof auth>>;
};

export function authValidator(roles: string[]) {
    return async (context: Context, next: () => Promise<void>) => {
        try {
            const authContext = await auth(roles);
            context.set('authContext', authContext);
            return await next();
        } catch (error) {
            console.warn('Unauthorized:', error);
            return context.newResponse('Unauthorized', { status: 401 });
        }
    };
}