'use client';

import { Checkbox } from '@gredice/ui/Checkbox';
import { IconButton } from '@gredice/ui/IconButton';
import { Close } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cancelOperationAction } from '../../(actions)/operationActions';
import { cancelRaisedBedFieldAction } from '../../(actions)/raisedBedFieldsActions';
import { CancelRequestModal } from './CancelRequestModal';

export type FieldCancelTarget = {
    id?: number;
    raisedBedId: number;
    positionIndex: number;
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
    label: string;
};

export type OperationCancelTarget = {
    id: number;
    entityId: number;
    taskVersionEventId: number;
    label: string;
};

interface BulkCancelRaisedBedButtonProps {
    physicalId: string;
    targetLabel?: string;
    fields: FieldCancelTarget[];
    operations: OperationCancelTarget[];
    onSubmit?: (formData: FormData) => unknown | Promise<unknown>;
}

function copyCancelOptions(source: FormData, target: FormData) {
    const reason = source.get('reason');
    if (typeof reason === 'string') {
        target.set('reason', reason);
    }

    for (const value of source.getAll('shouldRefund')) {
        if (typeof value === 'string') {
            target.append('shouldRefund', value);
        }
    }

    for (const value of source.getAll('shouldNotify')) {
        if (typeof value === 'string') {
            target.append('shouldNotify', value);
        }
    }
}

export function buildFieldCancelFormData(
    field: FieldCancelTarget,
    source: FormData,
) {
    const formData = new FormData();
    formData.set('raisedBedId', field.raisedBedId.toString());
    formData.set('positionIndex', field.positionIndex.toString());
    formData.set(
        'expectedPlantCycleEventId',
        field.expectedPlantCycleEventId.toString(),
    );
    formData.set(
        'expectedPlantCycleVersionEventId',
        field.expectedPlantCycleVersionEventId.toString(),
    );
    formData.set('expectedPlantSortId', field.expectedPlantSortId.toString());
    copyCancelOptions(source, formData);
    return formData;
}

export function buildOperationCancelFormData(
    operation: OperationCancelTarget,
    source: FormData,
) {
    const formData = new FormData();
    formData.set('operationId', operation.id.toString());
    formData.set('expectedEntityId', operation.entityId.toString());
    formData.set(
        'expectedTaskVersionEventId',
        operation.taskVersionEventId.toString(),
    );
    copyCancelOptions(source, formData);
    return formData;
}

export function BulkCancelRaisedBedButton({
    physicalId,
    targetLabel,
    fields,
    operations,
    onSubmit,
}: BulkCancelRaisedBedButtonProps) {
    const totalItems = fields.length + operations.length;
    const disabled = totalItems === 0;
    const targetText =
        targetLabel ??
        (physicalId === 'dan' ? 'za dan' : `za gredicu ${physicalId}`);

    async function handleSubmit(formData: FormData) {
        if (totalItems === 0) {
            return;
        }

        if (onSubmit) {
            await onSubmit(formData);
            return;
        }

        await Promise.all([
            ...fields.map((field) =>
                cancelRaisedBedFieldAction(
                    buildFieldCancelFormData(field, formData),
                ),
            ),
            ...operations.map((operation) =>
                cancelOperationAction(
                    buildOperationCancelFormData(operation, formData),
                ),
            ),
        ]);
    }

    return (
        <CancelRequestModal
            label={`sve zadatke (${totalItems}) ${targetText}`}
            onSubmit={handleSubmit}
            hiddenFields={null}
            description={`Svi odabrani zadaci (${totalItems}) bit će otkazani.`}
            confirmLabel="Otkaži zadatke"
            additionalFields={
                operations.length > 0 ? (
                    <Stack spacing={2}>
                        <input
                            type="hidden"
                            name="shouldRefund"
                            value="false"
                        />
                        <Checkbox
                            className="size-5"
                            name="shouldRefund"
                            value="true"
                            defaultChecked
                            label={
                                <Typography level="body2">
                                    Vrati suncokrete za radnje
                                </Typography>
                            }
                        />
                        <input
                            type="hidden"
                            name="shouldNotify"
                            value="false"
                        />
                        <Checkbox
                            className="size-5"
                            name="shouldNotify"
                            value="true"
                            defaultChecked
                            label={
                                <Typography level="body2">
                                    Pošalji obavijest korisniku za radnje
                                </Typography>
                            }
                        />
                    </Stack>
                ) : null
            }
            trigger={
                <IconButton
                    variant="plain"
                    size="xs"
                    title="Otkaži sve zadatke"
                    disabled={disabled}
                    aria-disabled={disabled}
                >
                    <Close className="size-4 shrink-0" />
                </IconButton>
            }
        />
    );
}

export default BulkCancelRaisedBedButton;
