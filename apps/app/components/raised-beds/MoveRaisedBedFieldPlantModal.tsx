'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useEffect, useState, useTransition } from 'react';
import { moveRaisedBedFieldPlantAction } from '../../app/(actions)/raisedBedFieldsActions';

type MoveRaisedBedFieldPlantOption = {
    value: string;
    label: string;
};

type MoveRaisedBedFieldPlantModalProps = {
    raisedBedId: number;
    sourcePositionIndex: number;
    sourcePlantPlaceEventId: number;
    sourcePlantLabel: string;
    targetOptions: MoveRaisedBedFieldPlantOption[];
};

export function MoveRaisedBedFieldPlantModal({
    raisedBedId,
    sourcePositionIndex,
    sourcePlantPlaceEventId,
    sourcePlantLabel,
    targetOptions,
}: MoveRaisedBedFieldPlantModalProps) {
    const [open, setOpen] = useState(false);
    const [selectedTarget, setSelectedTarget] = useState(
        targetOptions[0]?.value ?? '',
    );
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (targetOptions.some((option) => option.value === selectedTarget)) {
            return;
        }

        setSelectedTarget(targetOptions[0]?.value ?? '');
    }, [selectedTarget, targetOptions]);

    const handleMove = () => {
        if (!selectedTarget) {
            return;
        }

        startTransition(async () => {
            const targetPositionIndex = Number.parseInt(selectedTarget, 10);
            const result = await moveRaisedBedFieldPlantAction({
                raisedBedId,
                sourcePositionIndex,
                targetPositionIndex,
                sourcePlantPlaceEventId,
            });

            if (!result.success) {
                alert(result.message);
                return;
            }

            setOpen(false);
        });
    };

    return (
        <Modal
            title={`Premjesti biljku: ${sourcePlantLabel}`}
            trigger={
                <Button
                    variant="outlined"
                    size="sm"
                    disabled={targetOptions.length === 0}
                >
                    Premjesti
                </Button>
            }
            open={open}
            onOpenChange={setOpen}
        >
            <Stack spacing={2}>
                <Typography level="body2">
                    Premještanje čuva postojeće datume događaja i prenosi samo
                    odabranu povijest biljke. Ako na ciljnom polju postoji
                    preklapanje u tom vremenskom rasponu, povijesti će
                    zamijeniti pozicije.
                </Typography>

                <SelectItems
                    label="Ciljno polje"
                    placeholder="Odaberi polje"
                    items={targetOptions}
                    value={selectedTarget}
                    onValueChange={setSelectedTarget}
                    disabled={isPending || targetOptions.length === 0}
                />

                <Row spacing={1}>
                    <Button
                        variant="plain"
                        onClick={() => setOpen(false)}
                        disabled={isPending}
                    >
                        Odustani
                    </Button>
                    <Button
                        variant="solid"
                        onClick={handleMove}
                        disabled={!selectedTarget || isPending}
                        loading={isPending}
                    >
                        Premjesti
                    </Button>
                </Row>
            </Stack>
        </Modal>
    );
}
