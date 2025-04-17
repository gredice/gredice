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
                <main className="relative h-full">
                    <AuthProtectedSection auth={authAdmin}>
                        <div className="flex flex-row min-h-full">
                            <div className="p-4 min-w-64">
                                <Nav />
                            </div>
                            <div className="min-h-full grow pt-2">
                                <div className="p-4 bg-white border-l border-t rounded-tl-xl min-h-full">
                                <Suspense>
                                    {children}
                                </Suspense>
                                </div>
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