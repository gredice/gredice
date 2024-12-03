import { PropsWithChildren, Suspense } from "react";
import { PageNav } from "@signalco/ui/Nav";
import { AuthAppProvider } from "../../components/providers/AuthAppProvider";
import { SignedOut, AuthProtectedSection } from "@signalco/auth-server/components";
import { LoginDialog } from "./LoginDialog";
import { auth } from "../../lib/auth/auth";
import { SplitView } from "@signalco/ui/SplitView";
import { getEntityTypes } from "@gredice/storage";
import { Row } from "@signalco/ui-primitives/Row";
import Image from "next/image";
import { Typography } from "@signalco/ui-primitives/Typography";
import { MenuList } from "./MenuList";

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: PropsWithChildren) {
    const entityTypes = await getEntityTypes();
    const authAdmin = auth.bind(null, ['admin']);

    return (
        <AuthAppProvider>
            <div className="grow bg-secondary">
                <div className="h-12 px-4 flex items-center">
                    <Image src="/Logotype - gredice@2x.svg" width={140} height={38} alt="Gredice" quality={100} priority />
                </div>
                <main className="relative">
                    <AuthProtectedSection auth={authAdmin}>
                        <div className="flex flex-row">
                            <div className="p-4 min-w-64">
                                <MenuList entityTypes={entityTypes} />
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