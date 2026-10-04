import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';

export function DeliveryOperationalMetric({
    label,
    value,
}: {
    label: string;
    value: string | number;
}) {
    return (
        <Stack spacing={1}>
            <Typography level="body3" className="text-muted-foreground">
                {label}
            </Typography>
            <Typography level="h6" semiBold>
                {value}
            </Typography>
        </Stack>
    );
}
