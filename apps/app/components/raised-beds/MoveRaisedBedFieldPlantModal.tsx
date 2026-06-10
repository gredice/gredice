'use client';

import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Replace } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useEffect, useState, useTransition } from 'react';
import { moveRaisedBedFieldPlantAction } from '../../app/(actions)/raisedBedFieldsActions';
import { raisedBedFieldCardButtonClassName } from './RaisedBedFieldCard';

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
    triggerVariant?: 'button' | 'icon' | 'fieldIndex';
};

export function MoveRaisedBedFieldPlantModal({
    raisedBedId,
    sourcePositionIndex,
    sourcePlantPlaceEventId,
    sourcePlantLabel,
    targetOptions,
    triggerVariant = 'button',
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
                triggerVariant === 'fieldIndex' ? (
                    <button
                        type="button"
                        title="Premjesti biljku"
                        disabled={targetOptions.length === 0}
                        className={cx(
                            'inline-flex min-w-0 shrink-0 items-center rounded-full px-2 py-1 text-xs font-semibold transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-50',
                            raisedBedFieldCardButtonClassName,
                        )}
                    >
                        {sourcePositionIndex + 1}
                    </button>
                ) : triggerVariant === 'icon' ? (
                    <IconButton
                        variant="outlined"
                        size="sm"
                        title="Premjesti biljku"
                        disabled={targetOptions.length === 0}
                    >
                        <Replace className="size-4 shrink-0" />
                    </IconButton>
                ) : (
                    <Button
                        variant="outlined"
                        size="sm"
                        disabled={targetOptions.length === 0}
                    >
                        Premjesti
                    </Button>
                )
            }
            open={open}
            onOpenChange={setOpen}
        >
            <Stack spacing={4}>
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

                <Row spacing={2}>
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
