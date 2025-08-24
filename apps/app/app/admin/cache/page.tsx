import {
    bustCached,
    bustGrediceCached,
    directoriesCachedInfo,
    grediceCachedInfo,
} from '@gredice/storage';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { Fragment } from 'react';
import { ServerActionButton } from '../../../components/shared/ServerActionButton';
import { auth } from '../../../lib/auth/auth';

export const dynamic = 'force-dynamic';

export default async function CachePage() {
    await auth(['admin']);
    const grediceInfo = await grediceCachedInfo();
    const directoryInfo = await directoriesCachedInfo();

    async function bustGredicaCacheKey(key: string) {
        'use server';
        await auth(['admin']);
        await bustGrediceCached(key);
    }

    async function bustDirectoryCacheKey(key: string) {
        'use server';
        await auth(['admin']);
        await bustCached(key);
    }

    return (
        <Stack spacing={2}>
            <Typography level="h4" component="h1">
                Cache
            </Typography>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Gredice Cache</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                            {grediceInfo?.keys.length === 0 && (
                                <Typography className="col-span-2">
                                    Cache je prazan
                                </Typography>
                            )}
                            {grediceInfo?.keys.map((key) => (
                                <Fragment key={key}>
                                    <Typography>{key}</Typography>
                                    <ServerActionButton
                                        onClick={bustGredicaCacheKey.bind(
                                            null,
                                            key,
                                        )}
                                    >
                                        Očisti
                                    </ServerActionButton>
                                </Fragment>
                            ))}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Directory Cache</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                            {directoryInfo?.keys.length === 0 && (
                                <Typography className="col-span-2">
                                    Cache je prazan
                                </Typography>
                            )}
                            {directoryInfo?.keys.map((key) => (
                                <Fragment key={key}>
                                    <Typography>{key}</Typography>
                                    <ServerActionButton
                                        onClick={bustDirectoryCacheKey.bind(
                                            null,
                                            key,
                                        )}
                                    >
                                        Očisti
                                    </ServerActionButton>
                                </Fragment>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </Stack>
    );
}
