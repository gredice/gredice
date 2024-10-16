import { PropsWithChildren, Suspense } from "react";
import { PageNav } from "@signalco/ui/Nav";
import { AuthAppProvider } from "../../components/providers/AuthAppProvider";
import { SignedOut, AuthProtectedSection } from "@signalco/auth-server/components";
import { LoginDialog } from "./LoginDialog";
import { auth } from "../../lib/auth/auth";
import { SplitView } from "@signalco/ui/SplitView";
import { List } from "@signalco/ui-primitives/List";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import { ListTreeItem } from "@signalco/ui-primitives/ListTreeItem";
import { KnownPages } from "../../src/KnownPages";
import { Home } from "lucide-react";
import { getEntityTypes } from "@gredice/storage";
import { FileText } from "lucide-react";
import { EntityTypesList } from "./EntityTypesList";
import { createEntityType } from "../(actions)/entityActions";
import { Row } from "@signalco/ui-primitives/Row";
import Image from "next/image";
import { Typography } from "@signalco/ui-primitives/Typography";

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: PropsWithChildren) {
    const entityTypes = await getEntityTypes();

    return (
        <AuthAppProvider>
            <div className="grow flex">
                <PageNav
                    logo={(
                        <Row alignItems="end" spacing={1}>
                            <Image src="/Logotype - gredice@2x.svg" width={180} height={40} alt="Gredice" quality={100} priority />
                            <Typography level="h4" semiBold className="text-[#2e6f40] pb-1">Admin</Typography>
                        </Row>
                    )} />
                <main className="pt-16 relative grow">
                    <AuthProtectedSection auth={auth}>
                        <SplitView>
                            <List>
                                <ListItem href={KnownPages.Dashboard} label="Početna" startDecorator={<Home className="size-5" />} />
                                <ListTreeItem label="Zapisi" startDecorator={<FileText className="size-5" />}>
                                    <EntityTypesList
                                        entityTypes={entityTypes}
                                        createEntityType={createEntityType} />
                                </ListTreeItem>
                            </List>
                            <div className="bg-secondary min-h-full">
                                <Suspense>
                                    {children}
                                </Suspense>
                            </div>
                        </SplitView>
                    </AuthProtectedSection>
                    <SignedOut auth={auth}>
                        <div className="h-screen -mt-16 flex items-center justify-center">
                            <LoginDialog />
                        </div>
                    </SignedOut>
                </main>
            </div>
        </AuthAppProvider>
    )
}