import { Stack } from "@signalco/ui-primitives/Stack";
import { PropsWithChildren, Suspense } from "react";
import { PageNav } from "@signalco/ui/Nav";
import { AuthAppProvider } from "../../components/providers/AuthAppProvider";
import { AuthProtectedSection } from "@signalco/auth-client";
import { SignedOut } from "@signalco/auth-client/components";
import { LoginDialog } from "./LoginDialog";

export default function AdminLayout({ children }: PropsWithChildren) {
    return (
        <AuthAppProvider>
            <Stack>
                <PageNav
                    logo="Gredice Admin"
                    links={[
                        { href: '/admin', text: 'Dashboard' },
                        { href: '/admin/directories', text: 'Zapisi' },
                    ]} />
                <main className="mt-16 relative">
                    <AuthProtectedSection mode="hide">
                        <Suspense>
                            {children}
                        </Suspense>
                    </AuthProtectedSection>
                    <SignedOut>
                        <div className="h-screen -mt-16 flex items-center justify-center">
                            <LoginDialog />
                        </div>
                    </SignedOut>
                </main>
            </Stack>
        </AuthAppProvider>
    )
}