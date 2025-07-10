import { Popper } from "@signalco/ui-primitives/Popper";
import { ButtonGreen } from "../../shared-ui/ButtonGreen";
import { BlockImage } from "@gredice/ui/BlockImage";
import { useOperations } from "../../hooks/useOperations";
import { useSetShoppingCartItem } from "../../hooks/useSetShoppingCartItem";
import { Button } from "@signalco/ui-primitives/Button";
import { Row } from "@signalco/ui-primitives/Row";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Calendar } from "@signalco/ui-icons";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Input } from "@signalco/ui-primitives/Input";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Card } from "@signalco/ui-primitives/Card";
import { formatLocalDate } from "./RaisedBedPlantPicker";
import { useState } from "react";

function OperationScheduleModal({ operationId, onConfirm, disabled }: { operationId: number; onConfirm: (date: Date) => Promise<void>, disabled?: boolean }) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const operations = useOperations();
    const op = operations.data?.find(op => op.id === operationId);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const date = formData.get("scheduledDate") as string;
        if (date) {
            const scheduledDate = new Date(date);
            setIsLoading(true);
            await onConfirm(scheduledDate);
            setOpen(false);
            setIsLoading(false);
        }
    }

    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const threeMonthsFromTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth() + 3, tomorrow.getDate());
    const operationDefaultDate = formatLocalDate(tomorrow);
    const min = formatLocalDate(tomorrow);
    const max = formatLocalDate(threeMonthsFromTomorrow);

    return (
        <Modal
            className="border border-tertiary border-b-4"
            trigger={(
                <IconButton
                    title={`Zakaži zalijevanje: ${op?.information.label}`}
                    variant="soft"
                    disabled={disabled}>
                    <Calendar className="size-5 shrink-0" />
                </IconButton>
            )}
            title={`Zakaži zalijevanje: ${op?.information.label}`}
            open={open}
            onOpenChange={setOpen}>
            <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
                    <Typography level="h5">
                        Zakazivanje radnje
                    </Typography>
                    <Typography>Ova radnja će biti zakazana za odabrani datum.</Typography>
                    <Card>
                        <Row spacing={2}>
                            <img
                                src={op?.image?.cover?.url ?? "https://www.gredice.com/assets/plants/placeholder.png"}
                                alt={op?.information.label}
                                className="size-20 object-cover border rounded bg-card" />
                            <Stack>
                                <Typography className="mt-2" noWrap>
                                    {op?.information.label}
                                </Typography>
                                <Typography level="body2">
                                    {op?.information.shortDescription}
                                </Typography>
                            </Stack>
                        </Row>
                    </Card>
                    <Input
                        type="date"
                        label="Željeni datum radnje"
                        name="scheduledDate"
                        className="w-full bg-card"
                        disabled={isLoading}
                        defaultValue={operationDefaultDate}
                        min={min}
                        max={max}
                        required
                    />
                    <Button
                        type="submit"
                        variant="solid"
                        disabled={isLoading}
                        loading={isLoading}
                        startDecorator={<Calendar className="size-5 shrink-0" />}
                    >
                        Potvrdi
                    </Button>
                </Stack>
            </form>
        </Modal>
    );
}

export function RaisedBedWatering({ gardenId, raisedBedId }: { gardenId: number; raisedBedId: number }) {
    const operations = useOperations();
    const wateringOperations = operations.data?.filter(op => op.attributes.stage.information?.name === 'watering' && op.attributes.application === 'raisedBed1m');
    const setShoppingCartItem = useSetShoppingCartItem();

    async function handleWateringOperation(operationId: number, scheduledDate?: Date) {
        await setShoppingCartItem.mutateAsync({
            amount: 1,
            entityId: operationId.toString(),
            entityTypeName: 'operation',
            gardenId: gardenId,
            raisedBedId: raisedBedId,
            additionalData: scheduledDate
                ? JSON.stringify({
                    scheduledDate: scheduledDate ? scheduledDate.toISOString() : undefined,
                })
                : undefined,
            forceCreate: true
        });
    }

    return (
        <Popper
            className="border border-tertiary border-b-4"
            trigger={(
                <ButtonGreen
                    className="rounded-full p-0 pr-4 gap-0">
                    <BlockImage
                        width={56}
                        height={56}
                        alt="Zalijevanje"
                        blockName="Bucket"
                        className="size-14 -mt-3"
                    />
                    <span className="-ml-2">Zalijevanje</span>
                </ButtonGreen>
            )}>
            <div className="flex flex-col gap-2 p-2">
                {wateringOperations?.length ? (
                    wateringOperations.map(op => (
                        <Row key={op.id} spacing={1}>
                            <Button
                                variant="soft"
                                fullWidth
                                disabled={setShoppingCartItem.isPending}
                                onClick={() => handleWateringOperation(op.id)}>
                                {op.information.label}
                            </Button>
                            <OperationScheduleModal
                                operationId={op.id}
                                disabled={setShoppingCartItem.isPending}
                                onConfirm={async (date) => {
                                    await handleWateringOperation(op.id, date);
                                }} />
                        </Row>
                    ))
                ) : (
                    <span>Nema dostupnih operacija zalijevanja</span>
                )}
            </div>
        </Popper>
    );
}