import { PropsWithChildren, Suspense } from "react";
import { AuthAppProvider } from "../../components/providers/AuthAppProvider";
import { SignedOut, AuthProtectedSection } from "@signalco/auth-server/components";
import { LoginDialog } from "./LoginDialog";
import { auth } from "../../lib/auth/auth";
import { Nav } from "./Nav";

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: PropsWithChildren) {
    const authAdmin = auth.bind(null, ['admin']);
    return (
        <AuthAppProvider>
            <div className="grow bg-secondary">
                <main className="relative">
                    <AuthProtectedSection auth={authAdmin}>
                        <div className="flex flex-row">
                            <div className="p-4 min-w-64">
                                <Nav />
                            </div>
                            <div className="min-h-full grow py-4 px-2">
                                <Suspense>
                                    {children}
                                </Suspense>
                            </div>
                        </div>
                    </AuthProtectedSection>
                    <SignedOut auth={authAdmin}>
                        <LoginDialog />
                    </SignedOut>
                </main>
            </div>
        </AuthAppProvider>
    )
}