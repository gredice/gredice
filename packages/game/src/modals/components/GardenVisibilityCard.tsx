import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { ExternalLink, Globe, Warning } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Switch } from '@gredice/ui/Switch';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { useGameFlags } from '../../GameFlagsContext';
import { useUpdateGardenVisibility } from '../../hooks/useUpdateGardenVisibility';
import { KnownPages } from '../../knownPages';

type GardenVisibilityCardProps = {
    gardenId: number;
    gardenName: string;
    isPublic: boolean;
};

export function GardenVisibilityCard({
    gardenId,
    gardenName,
    isPublic,
}: GardenVisibilityCardProps) {
    const { publicGardensFlag } = useGameFlags();
    const updateVisibility = useUpdateGardenVisibility(gardenId);
    const [error, setError] = useState<string | null>(null);
    const publicUrl = KnownPages.GredicePublicGarden(gardenId);

    if (!publicGardensFlag) {
        return null;
    }

    function handleVisibilityChange(nextPublic: boolean) {
        setError(null);
        updateVisibility.mutate(
            { isPublic: nextPublic },
            {
                onError: () => {
                    setError(
                        'Nije moguće promijeniti vidljivost vrta. Pokušaj ponovno.',
                    );
                },
            },
        );
    }

    return (
        <Card>
            <CardContent noHeader>
                <Stack spacing={4}>
                    <Row spacing={4} alignItems="start">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 ring-4 ring-sky-200/70 dark:bg-sky-900/70 dark:text-sky-100 dark:ring-sky-800/70">
                            <Globe className="size-5 shrink-0" />
                        </div>
                        <Stack spacing={1} className="min-w-0 grow">
                            <Row
                                spacing={3}
                                alignItems="center"
                                className="justify-between gap-4"
                            >
                                <Typography level="body1" semiBold>
                                    Javni vrt
                                </Typography>
                                <Switch
                                    aria-label={`Javna vidljivost vrta ${gardenName}`}
                                    checked={isPublic}
                                    disabled={updateVisibility.isPending}
                                    onCheckedChange={handleVisibilityChange}
                                />
                            </Row>
                            <Typography level="body2">
                                {isPublic
                                    ? 'Svatko s poveznicom može pregledati vrt bez uređivanja.'
                                    : 'Vrt je privatan i nije dostupan na javnim stranicama.'}
                            </Typography>
                        </Stack>
                    </Row>
                    {isPublic ? (
                        <Button
                            href={publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            variant="outlined"
                            size="sm"
                            startDecorator={<ExternalLink className="size-4" />}
                        >
                            Otvori javni vrt
                        </Button>
                    ) : null}
                    {error ? (
                        <Alert
                            color="danger"
                            startDecorator={
                                <Warning className="size-4 shrink-0" />
                            }
                        >
                            <Typography level="body2">{error}</Typography>
                        </Alert>
                    ) : null}
                </Stack>
            </CardContent>
        </Card>
    );
}
