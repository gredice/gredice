import { Card, CardContent } from "@signalco/ui-primitives/Card";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Typography } from "@signalco/ui-primitives/Typography";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Euro, Hammer, Info } from "lucide-react"
import Image from "next/image";
import { OperationData } from "../../../lib/@types/OperationData";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Markdown } from "../../../components/shared/Markdown";
import { AttributeCard } from "../../../components/attributes/DetailCard";

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

function OperationImage({ operation }: { operation: OperationData }) {
    if (!operation.images?.cover?.url) {
        return (
            <Hammer className="size-[32px] min-w-[32px]" />
        );
    }

    return (
        <Image
            src={operation.images.cover.url}
            width={32}
            height={32}
            style={{
                objectFit: 'contain',
                width: '32px',
                height: '32px'
            }}
            alt={operation.information.label} />
    );
}

export function PlantOperations({ operations }: { operations?: OperationData[] }) {
    return (
        <div className="space-y-4">
            {operations?.map((operation) => (
                <div key={operation.information.name} className="flex flex-col md:flex-row md:items-center group gap-x-4">
                    <div className="w-16 font-semibold text-muted-foreground relative">
                        <span>Dan {operation.attributes.relativeDays}</span>
                        <div className="group-first:hidden absolute top-0 left-1/2 w-0.5 h-[54px] bg-muted-foreground/20 transform -translate-y-full" />
                    </div>
                    {/* TODO: Extract insutrction card */}
                    <Card className="flex-grow">
                        <CardContent className="py-0 pl-3 pr-0 flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <OperationImage operation={operation} />
                                <div>
                                    <h3 className="font-semibold">{operation.information.label}</h3>
                                    {operation.attributes.frequency && (
                                        <p className="text-sm text-muted-foreground">{operationFrequencyLabel(operation.attributes.frequency)}</p>
                                    )}
                                </div>
                            </div>
                            <Modal
                                title={operation.information.label}
                                className="border border-tertiary border-b-4"
                                trigger={(
                                    <IconButton
                                        size="lg"
                                        variant="plain"
                                        aria-label={`Više informacija o ${operation.information.label}`}
                                    >
                                        <Info />
                                    </IconButton>
                                )}>
                                <Stack spacing={4}>
                                    <Row spacing={2}>
                                        <OperationImage operation={operation} />
                                        <Stack spacing={1}>
                                            <Typography level="h4">{operation.information.label}</Typography>
                                            <p>{operation.information.shortDescription}</p>
                                        </Stack>
                                    </Row>
                                    <Markdown>{operation.information.description}</Markdown>
                                    <div className="grid grid-cols-2">
                                        <AttributeCard header="Cijena" icon={<Euro />} value={operation.prices.perOperation.toFixed(2)} />
                                    </div>
                                </Stack>
                            </Modal>
                        </CardContent>
                    </Card>
                </div>
            ))}
        </div>
    )
}