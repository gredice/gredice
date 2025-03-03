import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { ReactNode } from "react";
import { LocaleDateTime } from "../LocaleDateTime";

export function Field({ name, value, mono }: { name: string; value: Date | boolean | string | number | ReactNode | null | undefined, mono?: boolean }) {
    return (
        <Stack>
            <Typography level="body2" semiBold>{name}</Typography>
            <Typography level="body1" mono={mono} component={typeof value !== 'object' ? 'p' : 'div'}>
                {value instanceof Date
                    ? <LocaleDateTime>{value}</LocaleDateTime>
                    : (typeof value === 'boolean'
                        ? (value ? 'Da' : 'Ne')
                        : (value ?? '-'))}
            </Typography>
        </Stack>
    );
}