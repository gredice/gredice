import { Card, CardContent } from "@signalco/ui-primitives/Card";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Typography } from "@signalco/ui-primitives/Typography";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Info } from "lucide-react"
import Image from "next/image";

export type PlantInstruction = {
    id: number
    actionId: string,
    stage: string,
    label: string,
    iconUrl: string,
    frequency?: string
    info: string
    relativeDays: number
};

export function PlantingInstructions({ instructions }: { instructions?: PlantInstruction[] }) {
    return (
        <div className="space-y-4">
            {instructions?.map((instruction) => (
                <div key={instruction.id} className="flex flex-col md:flex-row md:items-center group gap-x-4">
                    <div className="w-16 font-semibold text-muted-foreground relative">
                        <span>Dan {instruction.relativeDays}</span>
                        <div className="group-first:hidden absolute top-0 left-1/2 w-0.5 h-[54px] bg-muted-foreground/20 transform -translate-y-full" />
                    </div>
                    {/* TODO: Extract insutrction card */}
                    <Card className="flex-grow">
                        <CardContent className="py-0 pl-3 pr-0 flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <Image
                                    src={instruction.iconUrl}
                                    width={32}
                                    height={32}
                                    style={{
                                        objectFit: 'contain',
                                        width: '32px',
                                        height: '32px'
                                    }}
                                    alt={instruction.label} />
                                <div>
                                    <h3 className="font-semibold">{instruction.label}</h3>
                                    {instruction.frequency && (
                                        <p className="text-sm text-muted-foreground">{instruction.frequency}</p>
                                    )}
                                </div>
                            </div>
                            <Modal
                                title={instruction.label}
                                trigger={(
                                    <IconButton
                                        size="lg"
                                        variant="plain"
                                        aria-label={`Više informacija o ${instruction.label}`}
                                    >
                                        <Info />
                                    </IconButton>
                                )}>
                                <Typography level="h4">{instruction.label}</Typography>
                                <p>{instruction.info}</p>
                            </Modal>
                        </CardContent>
                    </Card>
                </div>
            ))}
        </div>
    )
}