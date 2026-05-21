import { redirect } from 'next/navigation';
import type { PropsWithChildren, ReactNode } from 'react';

export type ServerAuth = () => Promise<unknown>;
type RedirectUrl = Parameters<typeof redirect>[0];

export async function SignedIn({
    auth,
    children,
}: PropsWithChildren<{ auth: ServerAuth }>): Promise<ReactNode> {
    try {
        await auth();
    } catch {
        return null;
    }

    return <>{children}</>;
}

export async function SignedOut({
    auth,
    children,
}: PropsWithChildren<{ auth: ServerAuth }>): Promise<ReactNode> {
    try {
        await auth();
        return null;
    } catch {
        return <>{children}</>;
    }
}

type ServerAuthProtectedSectionProps = PropsWithChildren<
    {
        auth: ServerAuth;
    } & (
        | {
              mode?: 'hide';
              redirectUrl?: never;
          }
        | {
              mode: 'redirect';
              redirectUrl: RedirectUrl;
          }
    )
>;

export async function AuthProtectedSection({
    auth,
    children,
    mode = 'hide',
    redirectUrl,
}: ServerAuthProtectedSectionProps): Promise<ReactNode> {
    try {
        await auth();
    } catch {
        if (mode === 'redirect' && redirectUrl) {
            redirect(redirectUrl);
        }

        return null;
    }

    return <>{children}</>;
}
