'use client';

import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Replace } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useActionState, useEffect, useMemo, useState } from 'react';
import {
    type SwitchOperationEntityActionState,
    switchOperationEntityAction,
} from '../../app/(actions)/operationActions';
import { canSwitchOperationTaskEntity } from '../../app/admin/schedule/scheduleShared';

export type OperationSwitchOption = {
    id: number;
    label: string;
};

interface OperationSwitchButtonProps {
    operationId: number;
    currentEntityId: number;
    taskVersionEventId: number;
    operationStatus: string;
    operationLabel: string;
    operationOptions: OperationSwitchOption[];
}

export function OperationSwitchButton({
    operationId,
    currentEntityId,
    taskVersionEventId,
    operationStatus,
    operationLabel,
    operationOptions,
}: OperationSwitchButtonProps) {
    const [open, setOpen] = useState(false);
    const [selectedEntityId, setSelectedEntityId] = useState(
        currentEntityId.toString(),
    );
    const [state, formAction, isPending] = useActionState<
        SwitchOperationEntityActionState | null,
        FormData
    >(switchOperationEntityAction, null);

    const currentEntityValue = currentEntityId.toString();
    const hasReplacementOptions = operationOptions.some(
        (operationOption) => operationOption.id !== currentEntityId,
    );
    const items = useMemo(
        () =>
            operationOptions.map((operationOption) => {
                const isCurrent = operationOption.id === currentEntityId;

                return {
                    value: operationOption.id.toString(),
                    label: isCurrent
                        ? `${operationOption.label} (trenutno)`
                        : operationOption.label,
                    disabled: isCurrent,
                };
            }),
        [currentEntityId, operationOptions],
    );

    useEffect(() => {
        if (state?.success) {
            setOpen(false);
        }
    }, [state?.success]);

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen);
        if (nextOpen) {
            setSelectedEntityId(currentEntityValue);
        }
    }

    if (
        !hasReplacementOptions ||
        !canSwitchOperationTaskEntity(operationStatus)
    ) {
        return null;
    }

    return (
        <Modal
            title="Promijeni radnju"
            open={open}
            onOpenChange={handleOpenChange}
            trigger={
                <IconButton
                    variant="plain"
                    title="Promijeni radnju"
                    loading={isPending}
                >
                    <Replace className="size-4 shrink-0" />
                </IconButton>
            }
        >
            <form action={formAction}>
                <Stack spacing={4}>
                    <Typography level="h5">Promijeni radnju</Typography>
                    <Typography>
                        <strong>{operationLabel}</strong>
                    </Typography>
                    <input
                        type="hidden"
                        name="operationId"
                        value={operationId}
                    />
                    <input
                        type="hidden"
                        name="expectedEntityId"
                        value={currentEntityId}
                    />
                    <input
                        type="hidden"
                        name="expectedTaskVersionEventId"
                        value={taskVersionEventId}
                    />
                    <input
                        type="hidden"
                        name="entityId"
                        value={selectedEntityId}
                    />
                    <SelectItems
                        items={items}
                        value={selectedEntityId}
                        onValueChange={setSelectedEntityId}
                        label="Nova radnja"
                        searchable
                        searchPlaceholder="Pretraži radnje..."
                    />
                    {state?.message && !state.success ? (
                        <Typography level="body2" className="text-red-600">
                            {state.message}
                        </Typography>
                    ) : null}
                    <Row spacing={2} justifyContent="end">
                        <Button
                            type="button"
                            variant="outlined"
                            onClick={() => setOpen(false)}
                            disabled={isPending}
                        >
                            Odustani
                        </Button>
                        <Button
                            type="submit"
                            loading={isPending}
                            disabled={
                                isPending ||
                                selectedEntityId === currentEntityValue
                            }
                        >
                            Promijeni
                        </Button>
                    </Row>
                </Stack>
            </form>
        </Modal>
    );
}
