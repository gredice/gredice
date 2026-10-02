import type { getPublicHarvestTraceGroupByToken } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';

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
                <Typography level="h1">{group.plantSortName}</Typography>
                <Typography>
                    {group.harvestLabel} · Gredica {group.raisedBedPhysicalId} ·
                    Polja {group.fieldLabel}
                </Typography>
                <Typography level="h2">
                    Odaberi polje za detalje berbe
                </Typography>
            </Stack>
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
    );
}
