'use client';

import { Divider } from '@gredice/ui/Divider';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { TimeOfDayDetails } from './TimeOfDayDetails';

export function TimeDisplay() {
    return (
        <Stack data-time-display="true" className="min-w-0">
            <Row
                className="bg-background px-4 py-2"
                justifyContent="space-between"
            >
                <Typography level="body2" bold>
                    Doba dana
                </Typography>
            </Row>
            <Divider />
            <TimeOfDayDetails />
        </Stack>
    );
}
