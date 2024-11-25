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
            <div className="grow flex">
                <PageNav
                    logo={(
                        <Row alignItems="end" spacing={1} className="relative">
                            <Image src="/Logotype - gredice@2x.svg" width={140} height={38} alt="Gredice" quality={100} priority />
                            <Typography level="body1" semiBold component="span" className="text-[#2e6f40] absolute right-0 -bottom-3 pb-[1px]">Admin</Typography>
                        </Row>
                    )} />
                <main className="pt-16 relative grow">
                    <AuthProtectedSection auth={authAdmin}>
                        <SplitView>
                            <MenuList entityTypes={entityTypes} />
                            <div className="bg-secondary min-h-full">
                                <Suspense>
                                    {children}
                                </Suspense>
                            </div>
                        </SplitView>
                    </AuthProtectedSection>
                    <SignedOut auth={authAdmin}>
                        <LoginDialog />
                    </SignedOut>
                </main>
            </div>
        </AuthAppProvider>
    )
}