'use client';

import { Button } from '@gredice/ui/Button';
import { Add } from '@gredice/ui/icons';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { KnownPages } from '../../../src/KnownPages';
import { createSeedlingTransplantingOperationAction } from './actions';

export function SeedlingTransplantingQuickAction({
    raisedBedId,
    positionIndex,
    existingOperationId,
}: {
    raisedBedId: number;
    positionIndex: number;
    existingOperationId: number | null;
}) {
    const router = useRouter();
    const [createdOperationId, setCreatedOperationId] = useState<number | null>(
        null,
    );
    const [isPending, startTransition] = useTransition();
    const operationId = createdOperationId ?? existingOperationId;

    if (operationId) {
        return (
            <Button
                color="success"
                href={KnownPages.Operation(operationId)}
                size="sm"
                title="Otvori radnju presađivanja"
                variant="soft"
            >
                Radnja #{operationId}
            </Button>
        );
    }

    function handleCreate() {
        startTransition(async () => {
            try {
                const result = await createSeedlingTransplantingOperationAction(
                    {
                        raisedBedId,
                        positionIndex,
                    },
                );
                setCreatedOperationId(result.operationId);
                router.refresh();
            } catch (error) {
                console.error(
                    'Error creating seedling transplanting operation:',
                    error,
                );
                alert(
                    error instanceof Error
                        ? error.message
                        : 'Kreiranje radnje presađivanja nije uspjelo.',
                );
            }
        });
    }

    return (
        <Button
            color="success"
            disabled={isPending}
            loading={isPending}
            onClick={handleCreate}
            size="sm"
            startDecorator={<Add className="size-4 shrink-0" />}
            title="Kreiraj radnju presađivanja presadnica"
            variant="outlined"
        >
            Kreiraj
        </Button>
    );
}
