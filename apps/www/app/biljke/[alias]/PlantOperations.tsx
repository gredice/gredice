import type { PlantData } from '@gredice/client';
import { Stack } from '@signalco/ui-primitives/Stack';
import { OperationCard } from '../../radnje/OperationCard';

export function operationFrequencyLabel(frequency: string | undefined) {
    switch (frequency) {
        case 'optional':
            return 'Opcionalno/po potrebi';
        case 'once':
            return 'Jednom';
        case 'periodic':
            return 'Periodično';
        case 'daily':
            return 'Svaki dan';
        case 'weekly':
            return 'Svake sedmice';
        case 'biweekly':
            return 'Svake dvije sedmice';
        case 'monthly':
            return 'Svakog mjeseca';
        default:
            return 'Nepoznato';
    }
}

export function PlantOperations({
    operations,
}: {
    operations?: PlantData['information']['operations'];
}) {
    const orderedOperations = operations?.sort((a, b) => {
        if (
            a.attributes?.relativeDays == null &&
            b.attributes?.relativeDays == null
        )
            return 0;
        if (a.attributes?.relativeDays == null) return 1;
        if (b.attributes?.relativeDays == null) return -1;
        return a.attributes.relativeDays - b.attributes.relativeDays;
    });

    return (
        <Stack spacing={1}>
            {orderedOperations?.map((operation, operationIndex) => (
                <div
                    key={operation.information?.name ?? operationIndex}
                    className="grid grid-cols-1 gap-2"
                >
                    <OperationCard operation={operation} />
                </div>
            ))}
        </Stack>
    );
}
