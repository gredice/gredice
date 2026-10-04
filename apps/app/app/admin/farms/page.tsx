import { getFarms } from '@gredice/storage';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { List, ListItem } from '@gredice/ui/List';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';

export const dynamic = 'force-dynamic';

export default async function FarmsPage() {
    await auth(['admin']);
    const farms = await getFarms();

    return (
        <Stack spacing={4}>
            <Card>
                <CardOverflow>
                    {farms.length === 0 ? (
                        <div className="p-4">
                            <NoDataPlaceholder>Nema farmi</NoDataPlaceholder>
                        </div>
                    ) : (
                        <List className="divide-y" spacing={0}>
                            {farms.map((farm) => (
                                <ListItem
                                    key={farm.id}
                                    href={KnownPages.Farm(farm.id)}
                                    className="rounded-none px-3 py-3 first:rounded-t-lg last:rounded-b-lg hover:bg-muted/40 sm:px-4"
                                    label={
                                        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                                            <Stack
                                                spacing={1}
                                                className="min-w-0"
                                            >
                                                <Typography
                                                    level="body1"
                                                    component="span"
                                                    semiBold
                                                    noWrap
                                                    className="text-foreground"
                                                >
                                                    {farm.name}
                                                </Typography>
                                                <Typography
                                                    level="body3"
                                                    className="font-mono text-muted-foreground"
                                                >
                                                    {farm.latitude.toFixed(4)}
                                                    °,{' '}
                                                    {farm.longitude.toFixed(4)}°
                                                </Typography>
                                            </Stack>
                                            <Typography
                                                level="body3"
                                                className="text-muted-foreground sm:text-right"
                                            >
                                                Kreirano:{' '}
                                                <LocalDateTime time={false}>
                                                    {farm.createdAt}
                                                </LocalDateTime>
                                            </Typography>
                                        </div>
                                    }
                                />
                            ))}
                        </List>
                    )}
                </CardOverflow>
            </Card>
        </Stack>
    );
}
