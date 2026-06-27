import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Delete, Warning } from '@gredice/ui/icons';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useDeleteGarden } from '../../hooks/useDeleteGarden';

type GardenDangerCardProps = {
    gardenId: number;
    gardenName: string;
};

const fallbackDeleteError =
    'Došlo je do greške prilikom brisanja vrta. Pokušaj ponovno.';

function gardenDeleteAvailabilityMessage(activeRaisedBedCount?: number) {
    if (activeRaisedBedCount === undefined) {
        return 'Provjeravamo status gredica prije brisanja vrta.';
    }

    if (activeRaisedBedCount === 0) {
        return 'Vrt nema aktivnih gredica i možeš ga obrisati.';
    }

    if (activeRaisedBedCount === 1) {
        return 'Vrt ima 1 aktivnu gredicu. Prvo napusti aktivnu gredicu, zatim obriši vrt.';
    }

    return `Vrt ima ${activeRaisedBedCount.toString()} aktivnih gredica. Prvo napusti aktivne gredice, zatim obriši vrt.`;
}

export function GardenDangerCard({
    gardenId,
    gardenName,
}: GardenDangerCardProps) {
    const { data: currentGarden } = useCurrentGarden();
    const deleteGarden = useDeleteGarden();
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const activeRaisedBedCount =
        currentGarden?.id === gardenId
            ? currentGarden.raisedBeds.filter(
                  (raisedBed) => raisedBed.status === 'active',
              ).length
            : undefined;
    const isDeleteAllowed = activeRaisedBedCount === 0;
    const isDeleteDisabled = !isDeleteAllowed || deleteGarden.isPending;

    function handleDeleteGarden() {
        if (isDeleteDisabled) {
            return;
        }

        setDeleteError(null);
        deleteGarden.mutate(
            { gardenId },
            {
                onError: (error) => {
                    setDeleteError(
                        error instanceof Error
                            ? error.message
                            : fallbackDeleteError,
                    );
                },
            },
        );
    }

    return (
        <Card className="border-red-200 bg-red-50/80 shadow-xs dark:border-red-900/60 dark:bg-red-950/80">
            <CardContent noHeader>
                <Stack spacing={4}>
                    <Row spacing={4} alignItems="start">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 ring-4 ring-red-200/70 dark:bg-red-900/70 dark:text-red-100 dark:ring-red-800/70">
                            <Warning className="size-5 shrink-0" />
                        </div>
                        <Stack spacing={1} className="min-w-0">
                            <Typography level="body1" semiBold>
                                Brisanje vrta
                            </Typography>
                            <Typography level="body2">
                                Brisanjem se vrt uklanja iz aplikacije. Ova
                                radnja se ne može poništiti.
                            </Typography>
                        </Stack>
                    </Row>
                    <Typography level="body2">
                        {gardenDeleteAvailabilityMessage(activeRaisedBedCount)}
                    </Typography>
                    {deleteError ? (
                        <Alert
                            color="danger"
                            startDecorator={
                                <Warning className="size-4 shrink-0" />
                            }
                        >
                            <Typography level="body2">{deleteError}</Typography>
                        </Alert>
                    ) : null}
                    <ModalConfirm
                        title="Potvrdi brisanje vrta"
                        header="Brisanje vrta"
                        expectedConfirm={gardenName}
                        promptLabel={`Upiši "${gardenName}" za potvrdu`}
                        confirmLabel="Obriši vrt"
                        onConfirm={handleDeleteGarden}
                        trigger={
                            <Button
                                type="button"
                                variant="solid"
                                color="danger"
                                disabled={isDeleteDisabled}
                                loading={deleteGarden.isPending}
                                startDecorator={<Delete className="size-4" />}
                            >
                                Obriši vrt
                            </Button>
                        }
                    >
                        <Stack spacing={4}>
                            <Typography>
                                Jeste li sigurni da želite obrisati vrt{' '}
                                <strong>{gardenName}</strong>?
                            </Typography>
                            <Typography level="body2">
                                Vrt će nestati iz popisa vrtova. Brisanje je
                                dostupno samo kada vrt nema aktivnih gredica.
                            </Typography>
                        </Stack>
                    </ModalConfirm>
                </Stack>
            </CardContent>
        </Card>
    );
}
