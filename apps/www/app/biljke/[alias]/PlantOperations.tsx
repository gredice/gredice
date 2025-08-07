import { Card, CardContent } from "@signalco/ui-primitives/Card";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { KnownPages } from "../../../src/KnownPages";
import { Info } from "@signalco/ui-icons";
import { PlantData } from "@gredice/client";
import { OperationImage } from "../../../components/operations/OperationImage";
import Link from "next/link";

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
            return "Nepoznato";
    }
}

export function PlantOperations({ operations }: { operations?: PlantData["information"]["operations"] }) {
    const orderedOperations = operations?.sort((a, b) => {
        if (a.attributes?.relativeDays == null && b.attributes?.relativeDays == null) return 0;
        if (a.attributes?.relativeDays == null) return 1;
        if (b.attributes?.relativeDays == null) return -1;
        return a.attributes.relativeDays - b.attributes.relativeDays;
    });

    return (
        <Stack spacing={1}>
            {orderedOperations?.map((operation, operationIndex) => (
                <div key={operation.information?.name ?? operationIndex} className="flex flex-col md:flex-row md:items-center group gap-x-4">
                    {/* TODO: Extract insutrction card */}
                    <Card className="flex-grow">
                        <CardContent className="py-0 pl-3 pr-0 flex items-center justify-between">
                            <Row spacing={2}>
                                <OperationImage operation={operation} />
                                <div>
                                    <h3 className="font-semibold">{operation.information?.label}</h3>
                                    {operation.attributes?.frequency && (
                                        <p className="text-sm text-muted-foreground">{operationFrequencyLabel(operation.attributes.frequency)}</p>
                                    )}
                                </div>
                            </Row>
                            <Row spacing={1}>
                                <span>
                                    {operation.prices?.perOperation.toFixed(2)}€
                                </span>
                                <Link href={operation.information?.label ? KnownPages.Operation(operation.information?.label) : KnownPages.Operations}>
                                    <IconButton
                                        size="lg"
                                        variant="plain"
                                        aria-label={`Više informacija o ${operation.information?.label}`}
                                    >
                                        <Info />
                                    </IconButton>
                                </Link>
                            </Row>
                        </CardContent>
                    </Card>
                </div>
            ))}
        </Stack>
    )
}