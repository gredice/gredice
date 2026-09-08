'use client';

import type { SelectedRaisedBedPlantingTaskCommandIdentity } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Popper } from '@gredice/ui/Popper';
import { SelectItems } from '@gredice/ui/SelectItems';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createSelectedPlantingOperationAction } from '../../app/(actions)/selectedRaisedBedPlantingActions';
import { KnownPages } from '../../src/KnownPages';

type SelectedPlantingOperationControlProps = {
    identity: SelectedRaisedBedPlantingTaskCommandIdentity;
    options: { value: string; label: string }[];
    label?: string;
};

export function SelectedPlantingOperationControl(
    props: SelectedPlantingOperationControlProps,
) {
    const { identity, options } = props;
    const formKey = `${identity.plantingId}:${identity.expectedPlantSortId}:${identity.expectedLifecycleVersionEventId}:${options.map((option) => option.value).join(',')}`;
    return <SelectedPlantingOperationForm key={formKey} {...props} />;
}

function SelectedPlantingOperationForm({
    identity,
    options,
    label = 'Dodaj radnju',
}: SelectedPlantingOperationControlProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [entityId, setEntityId] = useState(options[0]?.value ?? '');
    const [operationId, setOperationId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    if (!options.length) return null;
    if (operationId)
        return (
            <Button
                size="sm"
                variant="plain"
                href={KnownPages.Operation(operationId)}
            >
                Radnja #{operationId}
            </Button>
        );
    return (
        <Popper
            open={open}
            onOpenChange={setOpen}
            className="w-72 space-y-3 p-3"
            trigger={
                <Button size="sm" variant="plain">
                    {label}
                </Button>
            }
        >
            <SelectItems
                label="Radnja"
                items={options}
                value={entityId}
                onValueChange={setEntityId}
                disabled={pending}
            />
            {error && (
                <p role="alert" className="text-sm text-red-600">
                    {error}
                </p>
            )}
            <Button
                disabled={pending || !entityId}
                loading={pending}
                onClick={() => {
                    setError(null);
                    startTransition(async () => {
                        try {
                            const result =
                                await createSelectedPlantingOperationAction(
                                    identity,
                                    Number(entityId),
                                );
                            setOperationId(result.operationId);
                            setOpen(false);
                            router.refresh();
                        } catch (error) {
                            setError(
                                error instanceof Error
                                    ? error.message
                                    : 'Kreiranje radnje nije uspjelo.',
                            );
                        }
                    });
                }}
            >
                Kreiraj
            </Button>
        </Popper>
    );
}
