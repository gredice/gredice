import { Stack } from "@signalco/ui-primitives/Stack";
import { PropsWithChildren, Suspense } from "react";
import { PageNav } from "@signalco/ui/Nav";
import { AuthAppProvider } from "../../components/providers/AuthAppProvider";
import { SignedOut, AuthProtectedSection } from "@signalco/auth-server/components";
import { LoginDialog } from "./LoginDialog";
import { auth } from "../../lib/auth/auth";

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: PropsWithChildren) {
    return (
        <AuthAppProvider>
            <Stack>
                <PageNav
                    logo="Gredice Admin"
                    links={[
                        { href: '/admin', text: 'Početna' },
                        { href: '/admin/directories', text: 'Zapisi' },
                    ]} />
                <main className="mt-16 relative">
                    <AuthProtectedSection auth={auth} mode="hide">
                        <Suspense>
                            {children}
                        </Suspense>
                    </AuthProtectedSection>
                    <SignedOut auth={auth}>
                        <div className="h-screen -mt-16 flex items-center justify-center">
                            <LoginDialog />
                        </div>
                    </SignedOut>
                </main>
            </Stack>
        </AuthAppProvider>
    )
}