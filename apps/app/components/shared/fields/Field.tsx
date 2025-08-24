import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { ReactNode } from 'react';

export function Field({
    name,
    value,
    mono,
}: {
    name: string;
    value: Date | boolean | string | number | ReactNode | null | undefined;
    mono?: boolean;
}) {
    return (
        <Stack>
            <Typography level="body2" semiBold>
                {name}
            </Typography>
            <Typography
                level="body1"
                mono={mono}
                component={typeof value !== 'object' ? 'p' : 'div'}
                noWrap={typeof value === 'string' || typeof value === 'number'}
                title={
                    typeof value === 'string' || typeof value === 'number'
                        ? String(value)
                        : undefined
                }
            >
                {value instanceof Date ? (
                    <LocalDateTime>{value}</LocalDateTime>
                ) : typeof value === 'boolean' ? (
                    value ? (
                        'Da'
                    ) : (
                        'Ne'
                    )
                ) : (
                    (value ?? '-')
                )}
            </Typography>
        </Stack>
    );
}