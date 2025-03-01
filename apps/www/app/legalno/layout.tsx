import { ListHeader } from "@signalco/ui-primitives/List";
import { SplitView } from "@signalco/ui/SplitView";
import { ReactNode } from "react";
import { Stack } from "@signalco/ui-primitives/Stack";
import { LegalFilesMenu } from "./LegalFilesMenu";

export default function LegalLayout({ children }: { children: ReactNode }) {
    return (
        <SplitView minSize={212}>
            <Stack spacing={1} className="px-2 my-2 md:my-24">
                <ListHeader header="Legalno" />
                <LegalFilesMenu />
            </Stack>
            <div className="mb-12 md:mb-24">
                {children}
            </div>
        </SplitView>
    );
}