import { Card, CardContent } from "@signalco/ui-primitives/Card";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Typography } from "@signalco/ui-primitives/Typography";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Markdown } from "../../../components/shared/Markdown";
import { AttributeCard } from "../../../components/attributes/DetailCard";
import { NavigatingButton } from "@signalco/ui/NavigatingButton";
import { KnownPages } from "../../../src/KnownPages";
import { Euro, Info } from "@signalco/ui-icons";
import { PlantData } from "@gredice/client";
import { OperationImage } from "../../../components/operations/OperationImage";

function operationFrequencyLabel(frequency: string) {
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
            return frequency;
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
                                <Modal
                                    title={operation.information?.label ?? 'Informacije o operaciji'}
                                    className="border border-tertiary border-b-4 max-w-xl"
                                    trigger={(
                                        <IconButton
                                            size="lg"
                                            variant="plain"
                                            aria-label={`Više informacija o ${operation.information?.label}`}
                                        >
                                            <Info />
                                        </IconButton>
                                    )}>
                                    <Stack spacing={4}>
                                        <Row spacing={2}>
                                            <OperationImage operation={operation} />
                                            <Stack spacing={1}>
                                                <Typography level="h4">{operation.information?.label}</Typography>
                                                <p>{operation.information?.shortDescription}</p>
                                            </Stack>
                                        </Row>
                                        {operation.information?.description && (
                                            <Card>
                                                <CardContent>
                                                    <Markdown>{operation.information.description}</Markdown>
                                                </CardContent>
                                            </Card>
                                        )}
                                        <div className="grid grid-cols-2 gap-2">
                                            <AttributeCard header="Cijena" icon={<Euro />} value={operation.prices?.perOperation.toFixed(2)} />
                                        </div>
                                        <NavigatingButton
                                            href={KnownPages.GardenApp}
                                            className="bg-green-800 hover:bg-green-700 self-end">
                                            Moj vrt
                                        </NavigatingButton>
                                    </Stack>
                                </Modal>
                            </Row>
                        </CardContent>
                    </Card>
                </div>
            ))}
        </Stack>
    )
}