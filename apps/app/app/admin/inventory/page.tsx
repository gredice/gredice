import {
    getInventoryConfigs,
    getInventoryStatusItemsByConfigIds,
} from '@gredice/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { IconButton } from '@gredice/ui/IconButton';
import { Add, File } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { AdminPageHeader } from '../../../components/admin/navigation';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';
import { InventoryStatusProgress } from './[inventoryId]/InventoryStatusProgress';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
    await auth(['admin']);

    const configs = await getInventoryConfigs();
    const configIds = configs.map((config) => config.id);
    const statusItems = await getInventoryStatusItemsByConfigIds(configIds);
    const itemsByConfigId = new Map<number, typeof statusItems>(
        configIds.map((configId) => [configId, []]),
    );

    for (const statusItem of statusItems) {
        const configItems = itemsByConfigId.get(statusItem.inventoryConfigId);

        if (configItems) {
            configItems.push(statusItem);
        }
    }

    return (
        <Stack spacing={4}>
            <AdminPageHeader
                actions={
                    <IconButton
                        aria-label="Nova zaliha"
                        href={KnownPages.InventoryCreate}
                        title="Nova zaliha"
                        variant="solid"
                    >
                        <Add className="size-5" />
                    </IconButton>
                }
            />

            {configs.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <Stack spacing={4} className="items-center text-center">
                            <File className="size-12 text-muted-foreground" />
                            <Typography level="body1" secondary>
                                Nema konfiguriranih zaliha. Kreirajte prvu
                                zalihu za praćenje inventara.
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {configs.map((config) => (
                        <Link
                            key={config.id}
                            href={KnownPages.InventoryConfig(config.id)}
                        >
                            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                                <CardHeader>
                                    <CardTitle>{config.label}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Stack spacing={3}>
                                        <Typography level="body2" secondary>
                                            Stanje zalihe
                                        </Typography>
                                        <InventoryStatusProgress
                                            items={
                                                itemsByConfigId.get(
                                                    config.id,
                                                ) ?? []
                                            }
                                            defaultLowCountThreshold={
                                                config.lowCountThreshold
                                            }
                                            compact
                                        />
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </Stack>
    );
}
