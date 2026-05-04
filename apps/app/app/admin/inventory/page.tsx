import { getInventoryConfigs } from '@gredice/storage';
import { Add, File } from '@signalco/ui-icons';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { AdminPageHeader } from '../../../components/admin/navigation';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
    await auth(['admin']);

    const configs = await getInventoryConfigs();

    return (
        <Stack spacing={2}>
            <AdminPageHeader
                actions={
                    <Link href={KnownPages.InventoryCreate}>
                        <Row
                            spacing={1}
                            className="text-sm font-medium px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            <Add className="size-4" />
                            <span>Nova zaliha</span>
                        </Row>
                    </Link>
                }
            />

            {configs.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <Stack spacing={2} className="items-center text-center">
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
                                    <Stack spacing={1}>
                                        <Typography level="body2" secondary>
                                            Tip entiteta:{' '}
                                            {config.entityTypeName}
                                        </Typography>
                                        <Typography level="body2" secondary>
                                            Praćenje:{' '}
                                            {config.defaultTrackingType ===
                                            'pieces'
                                                ? 'Komadi'
                                                : 'Serijski broj'}
                                        </Typography>
                                        {config.fieldDefinitions.length > 0 && (
                                            <Typography level="body2" secondary>
                                                Dodatna polja:{' '}
                                                {config.fieldDefinitions.length}
                                            </Typography>
                                        )}
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
