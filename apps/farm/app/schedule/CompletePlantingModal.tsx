'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useRef, useState } from 'react';
import {
    completeFarmPlanting,
    refreshFarmScheduleAfterSubmission,
} from './actions';
import { ScheduleTaskCompletionButton } from './ScheduleTaskCompletionButton';
import { getScheduleTaskCompletionSuccessMessage } from './scheduleTaskSubmissionResult';

interface CompletePlantingModalProps {
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
    label: string;
    raisedBedId: number;
    positionIndex: number;
    defaultOpen?: boolean;
}

export function CompletePlantingModal({
    expectedPlantCycleEventId,
    expectedPlantCycleVersionEventId,
    expectedPlantSortId,
    label,
    raisedBedId,
    positionIndex,
    defaultOpen = false,
}: CompletePlantingModalProps) {
    const [open, setOpen] = useState(defaultOpen);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>();
    const [requiresRefresh, setRequiresRefresh] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string>();
    const submissionInFlightRef = useRef(false);
    const errorRef = useRef<HTMLDivElement>(null);

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen && submissionInFlightRef.current) {
            return;
        }

        if (!nextOpen) {
            if (successMessage) {
                finishSuccess();
                return;
            }
            if (!requiresRefresh) {
                setErrorMessage(undefined);
            }
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
            setErrorMessage(undefined);
            setRequiresRefresh(false);
            const result = await completeFarmPlanting(
                raisedBedId,
                positionIndex,
                expectedPlantCycleEventId,
                expectedPlantCycleVersionEventId,
                expectedPlantSortId,
            );
            if (!result.success) {
                setErrorMessage(result.message);
                setRequiresRefresh(!result.canRetry);
                requestAnimationFrame(() => errorRef.current?.focus());
                return;
            }
            setSuccessMessage(
                getScheduleTaskCompletionSuccessMessage({
                    kind: 'planting',
                    label,
                    state: result.state,
                }),
            );
        } catch (error) {
            console.error('Error completing planting:', error);
            setErrorMessage(
                'Sijanje nije spremljeno. Provjeri vezu i pokušaj ponovno.',
            );
            setRequiresRefresh(false);
            requestAnimationFrame(() => errorRef.current?.focus());
        } finally {
            submissionInFlightRef.current = false;
            setIsSubmitting(false);
        }
    };

    const finishSuccess = () => {
        setSuccessMessage(undefined);
        setErrorMessage(undefined);
        setRequiresRefresh(false);
        setOpen(false);
        void refreshFarmScheduleAfterSubmission().catch((error) => {
            console.error('Error refreshing completed planting:', error);
            window.location.reload();
        });
    };

    const refreshTasks = () => {
        setErrorMessage(undefined);
        setRequiresRefresh(false);
        setOpen(false);
        window.location.reload();
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
            {successMessage ? (
                <Stack spacing={4}>
                    <h2 className="text-lg font-semibold">
                        Sijanje spremljeno
                    </h2>
                    <Alert color="success" role="status">
                        {successMessage}
                    </Alert>
                    <Button
                        fullWidth
                        onClick={finishSuccess}
                        size="lg"
                        type="button"
                        variant="solid"
                    >
                        U redu
                    </Button>
                </Stack>
            ) : (
                <Stack spacing={4}>
                    <Typography>
                        Jeste li sigurni da želite označiti da je posijano:{' '}
                        <strong>{label}</strong>?
                    </Typography>
                    {errorMessage ? (
                        <div
                            data-schedule-submission-error
                            ref={errorRef}
                            tabIndex={-1}
                        >
                            <Alert color="danger" role="alert">
                                {errorMessage}
                            </Alert>
                        </div>
                    ) : null}
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
                            onClick={
                                requiresRefresh ? refreshTasks : handleConfirm
                            }
                            loading={isSubmitting}
                            disabled={isSubmitting}
                            size="lg"
                        >
                            {errorMessage
                                ? requiresRefresh
                                    ? 'Osvježi zadatke'
                                    : 'Pokušaj ponovno'
                                : 'Potvrdi'}
                        </Button>
                    </Row>
                </Stack>
            )}
        </Modal>
    );
}

export default CompletePlantingModal;
