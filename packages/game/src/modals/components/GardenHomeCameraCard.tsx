import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Check, MapPinHouse, Warning } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import type { GameCameraSnapshot } from '../../controls/GameCameraRigApi';
import {
    type GardenHomeCamera,
    useUpdateGardenHomeCamera,
} from '../../hooks/useUpdateGardenHomeCamera';
import { useGameState } from '../../useGameState';

type GardenHomeCameraCardProps = {
    gardenId: number;
    hasHomeCamera: boolean;
};

function homeCameraFromCurrentSnapshot(
    snapshot: GameCameraSnapshot,
): GardenHomeCamera {
    return {
        position: snapshot.position,
        target: snapshot.target,
        zoom: snapshot.zoom,
    };
}

export function GardenHomeCameraCard({
    gardenId,
    hasHomeCamera,
}: GardenHomeCameraCardProps) {
    const gameCamera = useGameState((state) => state.gameCamera);
    const updateHomeCamera = useUpdateGardenHomeCamera(gardenId);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    function handleSaveHomeCamera() {
        setError(null);
        setSaved(false);

        const snapshot = gameCamera?.getSnapshot();
        if (!snapshot) {
            setError(
                'Trenutni položaj kamere nije dostupan. Pokušaj ponovno nakon učitavanja vrta.',
            );
            return;
        }

        updateHomeCamera.mutate(
            { homeCamera: homeCameraFromCurrentSnapshot(snapshot) },
            {
                onSuccess: () => setSaved(true),
                onError: () => {
                    setError(
                        'Nije moguće spremiti početni položaj vrta. Pokušaj ponovno.',
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
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-4 ring-emerald-200/70 dark:bg-emerald-900/70 dark:text-emerald-100 dark:ring-emerald-800/70">
                            <MapPinHouse className="size-5 shrink-0" />
                        </div>
                        <Stack spacing={1} className="min-w-0 grow">
                            <Typography level="body1" semiBold>
                                Početni položaj vrta
                            </Typography>
                            <Typography level="body2">
                                {hasHomeCamera
                                    ? 'Spremljeni položaj koristi se pri otvaranju vrta i javnim prikazima.'
                                    : 'Spremi trenutni pogled kao početni položaj vrta.'}
                            </Typography>
                        </Stack>
                    </Row>
                    <Button
                        type="button"
                        variant="outlined"
                        size="sm"
                        startDecorator={<MapPinHouse className="size-4" />}
                        disabled={!gameCamera || updateHomeCamera.isPending}
                        loading={updateHomeCamera.isPending}
                        onClick={handleSaveHomeCamera}
                    >
                        Postavi trenutni prikaz
                    </Button>
                    {saved ? (
                        <Alert
                            color="success"
                            startDecorator={<Check className="size-4" />}
                        >
                            <Typography level="body2">
                                Početni položaj je spremljen.
                            </Typography>
                        </Alert>
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
