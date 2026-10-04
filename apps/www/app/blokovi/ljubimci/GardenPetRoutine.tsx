import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';

export function GardenPetRoutine({
    icon,
    label,
    value,
}: {
    icon: ReactNode;
    label: string;
    value: string;
}) {
    return (
        <Row alignItems="start" spacing={2}>
            <span aria-hidden className="mt-0.5 shrink-0 text-muted-foreground">
                {icon}
            </span>
            <Stack>
                <Typography level="body3" secondary>
                    {label}
                </Typography>
                <Typography level="body2">{value}</Typography>
            </Stack>
        </Row>
    );
}
