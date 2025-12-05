import { SplitView } from '@signalco/ui/SplitView';
import { ListHeader } from '@signalco/ui-primitives/List';
import { Stack } from '@signalco/ui-primitives/Stack';
import type { ReactNode } from 'react';
import { LegalFilesMenu } from './LegalFilesMenu';
import { OccasionsFilesMenu } from './OccasionsFilesMenu';

export default function LegalLayout({ children }: { children: ReactNode }) {
    return (
        <SplitView minSize={212}>
            <Stack spacing={2} className="px-2 my-2 md:my-24">
                <Stack spacing={1}>
                    <ListHeader header="Legalno" />
                    <LegalFilesMenu />
                </Stack>
                <Stack spacing={1}>
                    <ListHeader header="Natječaji" />
                    <OccasionsFilesMenu />
                </Stack>
            </Stack>
            <div className="mb-12 md:mb-24">{children}</div>
        </SplitView>
    );
}
