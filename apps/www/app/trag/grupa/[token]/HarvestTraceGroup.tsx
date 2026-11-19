import type { getPublicHarvestTraceGroupByToken } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { Card } from '../../../../components/shared/Card';

export function HarvestTraceGroup({
    group,
}: {
    group: NonNullable<
        Awaited<ReturnType<typeof getPublicHarvestTraceGroupByToken>>
    >;
}) {
    return (
        <Stack spacing={5} className="mx-auto max-w-2xl py-8 sm:py-12">
            <Stack spacing={2}>
                <Typography
                    level="body2"
                    semiBold
                    className="text-primary uppercase tracking-wide"
                >
                    Trag berbe
                </Typography>
                <Typography
                    level="h1"
                    className="break-words text-3xl sm:text-4xl"
                >
                    {group.plantSortName}
                </Typography>
                <Typography className="text-muted-foreground">
                    {group.harvestLabel} · Gredica {group.raisedBedPhysicalId} ·
                    Polja {group.fieldLabel}
                </Typography>
            </Stack>
            <Card className="p-4 sm:p-6">
                <Stack spacing={4}>
                    <Typography level="h5" component="h2">
                        Odaberi polje za detalje berbe
                    </Typography>
                    <nav
                        aria-label="Polja u ovoj berbi"
                        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                    >
                        {group.fields.map((field) => (
                            <Button
                                key={field.publicPath}
                                href={field.publicPath}
                                variant="outlined"
                                size="lg"
                            >
                                Polje {field.fieldLabel}
                            </Button>
                        ))}
                    </nav>
                </Stack>
            </Card>
        </Stack>
    );
}
