import { ListHeader } from "@signalco/ui-primitives/List";
import { SplitView } from "@signalco/ui/SplitView";
import { ReactNode } from "react";
import { Stack } from "@signalco/ui-primitives/Stack";
import { LegalFilesMenu } from "./LegalFilesMenu";



export default function LegalLayout({ children }: { children: ReactNode }) {
    return (
        <SplitView>
            <Stack spacing={1} className="px-4 py-12 md:py-24">
                <ListHeader header="Legalno" />
                <LegalFilesMenu />
            </Stack>
            {children}
        </SplitView>
    );
}