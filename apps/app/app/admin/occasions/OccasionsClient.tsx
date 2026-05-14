'use client';

import type { AdventCalendarTopUser } from '@gredice/storage';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { TopAdventUsersCard } from '../../../components/admin/dashboard/TopAdventUsersCard';

type OccasionsClientProps = {
    topAdventUsers2025: AdventCalendarTopUser[];
};

export function OccasionsClient({ topAdventUsers2025 }: OccasionsClientProps) {
    return (
        <Stack spacing={4}>
            <Typography level="h1" semiBold>
                Prigode
            </Typography>
            <Stack spacing={2}>
                <TopAdventUsersCard year={2025} users={topAdventUsers2025} />
            </Stack>
        </Stack>
    );
}
