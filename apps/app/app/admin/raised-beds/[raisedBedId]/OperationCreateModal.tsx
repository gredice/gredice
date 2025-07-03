'use client';

import { Input } from "@signalco/ui-primitives/Input";
import { Button } from "@signalco/ui-primitives/Button";
import { Modal } from "@signalco/ui-primitives/Modal";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Add } from "@signalco/ui-icons";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Stack } from "@signalco/ui-primitives/Stack";
import { createOperationAction } from "../../../(actions)/operationActions";
import { SelectEntity } from "./SelectEntity";

type OperationCreateModalProps = {
    accountId: string;
    gardenId?: number;
    raisedBedId?: number;
    raisedBedFieldId?: number;
};

export function OperationCreateModal({ accountId, gardenId, raisedBedId, raisedBedFieldId }: OperationCreateModalProps) {
    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const result = await createOperationAction(formData);
        if (result.success) {
            // TODO: Handle successful operation creation (e.g., close modal, show notification)
        } else {
            // TODO: Handle error (e.g., show error message)
        }
    };

    return (
        <Modal
            title={"Nova operacija"}
            trigger={(
                <IconButton title="Nova operacija">
                    <Add className="size-5" />
                </IconButton>
            )}>
            <Stack spacing={4}>
                <Typography level="h5">Nova operacija</Typography>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Stack spacing={2}>
                        <div className="grid grid-cols-2 gap-4">
                            <Input name="entityTypeName" label="Tip entiteta" defaultValue="operation" required hidden />
                            <SelectEntity
                                name="entityId"
                                label="ID entiteta"
                                required
                                entityTypeName={'operation'}
                            />
                            <Input name="accountId" defaultValue={accountId} label="Account ID" required />
                            <Input name="gardenId" defaultValue={gardenId} label="Vrt ID (opcionalno)" type="number" />
                            <Input name="raisedBedId" defaultValue={raisedBedId} label="Gredica ID (opcionalno)" />
                            <Input name="raisedBedFieldId" defaultValue={raisedBedFieldId} label="Polje gredice ID (opcionalno)" />
                            <Input name="timestamp" type="datetime-local" label="Datum kreiranja (opcionalno)" />
                            <Input name="scheduledDate" type="datetime-local" label="Planirani datum (opcionalno)" />
                        </div>
                        <Button type="submit">
                            Kreiraj
                        </Button>
                    </Stack>
                </form>
            </Stack>
        </Modal>
    );
}