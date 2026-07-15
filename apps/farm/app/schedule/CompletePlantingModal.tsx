'use client';

import { Button } from '@gredice/ui/Button';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useRef, useState } from 'react';
import { completeFarmPlanting } from './actions';
import { ScheduleTaskCompletionButton } from './ScheduleTaskCompletionButton';

interface CompletePlantingModalProps {
    label: string;
    raisedBedId: number;
    positionIndex: number;
    defaultOpen?: boolean;
}

export function CompletePlantingModal({
    label,
    raisedBedId,
    positionIndex,
    defaultOpen = false,
}: CompletePlantingModalProps) {
    const [open, setOpen] = useState(defaultOpen);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const submissionInFlightRef = useRef(false);

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen && submissionInFlightRef.current) {
            return;
        }

        setOpen(nextOpen);
    };

    const handleConfirm = async () => {
        if (submissionInFlightRef.current) {
            return;
        }

        submissionInFlightRef.current = true;
        try {
            setIsSubmitting(true);
            await completeFarmPlanting(raisedBedId, positionIndex);
            submissionInFlightRef.current = false;
            setOpen(false);
        } catch (error) {
            console.error('Error completing planting:', error);
        } finally {
            submissionInFlightRef.current = false;
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            title="Potvrda sijanja"
            dismissible={!isSubmitting}
            open={open}
            onOpenChange={handleOpenChange}
            trigger={
                <ScheduleTaskCompletionButton
                    actionLabel="Dovrši sijanje"
                    label={label}
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
                        onClick={() => handleOpenChange(false)}
                        disabled={isSubmitting}
                        size="lg"
                    >
                        Odustani
                    </Button>
                    <Button
                        variant="solid"
                        aria-busy={isSubmitting}
                        onClick={handleConfirm}
                        loading={isSubmitting}
                        disabled={isSubmitting}
                        size="lg"
                    >
                        Potvrdi
                    </Button>
                </Row>
            </Stack>
        </Modal>
    );
}

export default CompletePlantingModal;
