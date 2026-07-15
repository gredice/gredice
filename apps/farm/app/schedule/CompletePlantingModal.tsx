'use client';

import { Button } from '@gredice/ui/Button';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { completeFarmPlanting } from './actions';

interface CompletePlantingModalProps {
    label: string;
    raisedBedId: number;
    positionIndex: number;
}

export function CompletePlantingModal({
    label,
    raisedBedId,
    positionIndex,
}: CompletePlantingModalProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        try {
            setIsSubmitting(true);
            await completeFarmPlanting(raisedBedId, positionIndex);
            setOpen(false);
        } catch (error) {
            console.error('Error completing planting:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            title="Potvrda sijanja"
            open={open}
            onOpenChange={setOpen}
            trigger={
                <Checkbox
                    aria-label={`Dovrši: ${label}`}
                    className="size-5"
                    checked={open}
                    onCheckedChange={(checked: boolean) => setOpen(checked)}
                />
            }
        >
            <Stack spacing={4}>
                <Typography>
                    Jeste li sigurni da želite označiti da je posijano:{' '}
                    <strong>{label}</strong>?
                </Typography>
                <Row
                    spacing={2}
                    justifyContent="end"
                    className="flex-wrap gap-y-2"
                >
                    <Button
                        variant="outlined"
                        onClick={() => setOpen(false)}
                        disabled={isSubmitting}
                    >
                        Odustani
                    </Button>
                    <Button
                        variant="solid"
                        onClick={handleConfirm}
                        loading={isSubmitting}
                        disabled={isSubmitting}
                    >
                        Potvrdi
                    </Button>
                </Row>
            </Stack>
        </Modal>
    );
}

export default CompletePlantingModal;
