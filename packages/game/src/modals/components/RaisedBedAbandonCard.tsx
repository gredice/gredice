import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Warning } from '@gredice/ui/icons';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { Row } from '@gredice/ui/Row';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { useAbandonRaisedBed } from '../../hooks/useAbandonRaisedBed';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { RAISED_BED_ABANDON_FAILED_MESSAGE } from '../../raisedBedConstants';

type RaisedBedAbandonCardProps = {
    gardenId: number;
};

export function RaisedBedAbandonCard({ gardenId }: RaisedBedAbandonCardProps) {
    const { data: currentGarden } = useCurrentGarden();
    const abandonRaisedBed = useAbandonRaisedBed(gardenId);
    const [selectedRaisedBedId, setSelectedRaisedBedId] = useState<string>();
    const [abandonError, setAbandonError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const activeRaisedBeds =
        currentGarden?.id === gardenId
            ? currentGarden.raisedBeds.filter(
                  (raisedBed) => raisedBed.status === 'active',
              )
            : undefined;
    const selectedRaisedBed = activeRaisedBeds?.find(
        (raisedBed) => raisedBed.id.toString() === selectedRaisedBedId,
    );
    const isSelectionValid = selectedRaisedBed?.status === 'active';
    const isActionDisabled = !isSelectionValid || abandonRaisedBed.isPending;

    function handleSelectionChange(raisedBedId: string) {
        setSelectedRaisedBedId(raisedBedId);
        setAbandonError(null);
        setSuccessMessage(null);
    }

    function handleAbandonRaisedBed() {
        if (!selectedRaisedBed || isActionDisabled) {
            return;
        }

        const raisedBedName = selectedRaisedBed.name;
        setAbandonError(null);
        setSuccessMessage(null);
        abandonRaisedBed.mutate(selectedRaisedBed.id, {
            onSuccess: () => {
                setSelectedRaisedBedId(undefined);
                setSuccessMessage(
                    `Postupak napuštanja gredice „${raisedBedName}” je pokrenut.`,
                );
            },
            onError: (error) => {
                setAbandonError(
                    error instanceof Error
                        ? error.message
                        : RAISED_BED_ABANDON_FAILED_MESSAGE,
                );
            },
        });
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
                                Napuštanje gredice
                            </Typography>
                            <Typography level="body2">
                                Odaberi aktivnu gredicu koju želiš odspojiti od
                                vrta.
                            </Typography>
                        </Stack>
                    </Row>
                    <Typography level="body2">
                        Napuštanjem se uklanjaju sve biljke, senzori i povezani
                        podaci. Radnja se ne može poništiti, a gredicu će biti
                        potrebno ponovno zatražiti želiš li je opet koristiti.
                    </Typography>
                    <SelectItems
                        disabled={
                            activeRaisedBeds === undefined ||
                            activeRaisedBeds.length === 0 ||
                            abandonRaisedBed.isPending
                        }
                        items={(activeRaisedBeds ?? []).map((raisedBed) => ({
                            label: raisedBed.name,
                            value: raisedBed.id.toString(),
                        }))}
                        label="Aktivna gredica"
                        onValueChange={handleSelectionChange}
                        placeholder="Odaberi gredicu"
                        value={selectedRaisedBedId}
                    />
                    {activeRaisedBeds === undefined ? (
                        <Typography level="body2" secondary>
                            Provjeravamo status gredica.
                        </Typography>
                    ) : activeRaisedBeds.length === 0 ? (
                        <Typography level="body2" secondary>
                            Vrt nema aktivnih gredica za napuštanje.
                        </Typography>
                    ) : null}
                    {abandonError ? (
                        <Alert
                            color="danger"
                            startDecorator={
                                <Warning className="size-4 shrink-0" />
                            }
                        >
                            <Typography level="body2">
                                {abandonError}
                            </Typography>
                        </Alert>
                    ) : null}
                    {successMessage ? (
                        <Alert color="success">
                            <Typography level="body2">
                                {successMessage}
                            </Typography>
                        </Alert>
                    ) : null}
                    <ModalConfirm
                        title="Potvrdi napuštanje gredice"
                        header="Napuštanje gredice"
                        confirmLabel="Napusti gredicu"
                        onConfirm={handleAbandonRaisedBed}
                        trigger={
                            <Button
                                type="button"
                                variant="solid"
                                color="danger"
                                disabled={isActionDisabled}
                                loading={abandonRaisedBed.isPending}
                            >
                                Napusti gredicu
                            </Button>
                        }
                    >
                        <Stack spacing={4}>
                            <Typography>
                                Napuštanjem gredice{' '}
                                <strong>{selectedRaisedBed?.name}</strong>{' '}
                                uklonit će se sve biljke, senzori i povezani
                                podaci.
                            </Typography>
                            <Typography level="body2">
                                Potvrdom će se pokrenuti postupak napuštanja.
                                Ova se radnja ne može poništiti.
                            </Typography>
                        </Stack>
                    </ModalConfirm>
                </Stack>
            </CardContent>
        </Card>
    );
}
