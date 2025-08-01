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
                    <div className="flex flex-row min-h-full">
                        <div className="p-4 min-w-64">
                            <AuthProtectedSection auth={authAdmin}>
                                <Nav />
                            </AuthProtectedSection>
                        </div>
                        <div className="min-h-full grow pt-2">
                            <div className="p-4 bg-white border-l border-t rounded-tl-xl min-h-full">
                                <AuthProtectedSection auth={authAdmin}>
                                    <Suspense>
                                        {children}
                                    </Suspense>
                                </AuthProtectedSection>
                            </div>
                        </div>
                    </div>
                    <SignedOut auth={authAdmin}>
                        <div className="absolute inset-0 bg-white/10 backdrop-blur">
                            <LoginDialog />
                        </div>
                    </SignedOut>
                </main>
            </div>
        </AuthAppProvider>
    )
}