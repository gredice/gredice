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
import { SelectRaisedBed } from "./SelectRaisedBed";
import { SelectRaisedBedField } from "./SelectRaisedBedField";
import { useState } from "react";

type OperationCreateModalProps = {
    accountId: string;
    gardenId?: number;
    raisedBedId?: number;
    raisedBedFieldId?: number;
};

export function OperationCreateModal({ accountId, gardenId, raisedBedId, raisedBedFieldId }: OperationCreateModalProps) {
    const [selectedRaisedBedId, setSelectedRaisedBedId] = useState<string | null>(raisedBedId?.toString() ?? null);

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
                <IconButton title="Nova operacija" variant="outlined">
                    <Add className="size-4" />
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
                            <SelectRaisedBed
                                name="raisedBedId"
                                label="Gredica"
                                accountId={accountId}
                                gardenId={gardenId}
                                value={selectedRaisedBedId}
                                onChange={setSelectedRaisedBedId}
                                disabled={!gardenId}
                            />
                            <SelectRaisedBedField
                                name="raisedBedFieldId"
                                label="Polje gredice"
                                raisedBedId={selectedRaisedBedId ? parseInt(selectedRaisedBedId) : undefined}
                                gardenId={gardenId}
                                defaultValue={raisedBedFieldId?.toString()}
                                disabled={!selectedRaisedBedId}
                            />
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