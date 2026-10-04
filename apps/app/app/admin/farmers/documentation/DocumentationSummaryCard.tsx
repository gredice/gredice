import { Card, CardContent } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';

export function DocumentationSummaryCard({
    label,
    value,
}: {
    label: string;
    value: number | string;
}) {
    return (
        <Card>
            <CardContent noHeader className="p-4">
                <Stack spacing={1}>
                    <Typography level="body3" className="text-muted-foreground">
                        {label}
                    </Typography>
                    <Typography level="h5" component="div" semiBold>
                        {value}
                    </Typography>
                </Stack>
            </CardContent>
        </Card>
    );
}
