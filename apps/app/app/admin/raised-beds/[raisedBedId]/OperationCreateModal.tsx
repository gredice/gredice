'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import { Add, Warning } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { createOperationAction } from '../../../(actions)/operationActions';
import { SelectEntity } from './SelectEntity';
import { SelectRaisedBed } from './SelectRaisedBed';
import { SelectRaisedBedField } from './SelectRaisedBedField';

type OperationCreateModalProps = {
    accountId: string;
    gardenId?: number;
    raisedBedId?: number;
    raisedBedFieldId?: number;
};

export function OperationCreateModal({
    accountId,
    gardenId,
    raisedBedId,
    raisedBedFieldId,
}: OperationCreateModalProps) {
    const [selectedRaisedBedId, setSelectedRaisedBedId] = useState<
        string | null
    >(raisedBedId?.toString() ?? null);
    const [message, setMessage] = useState<string | null>(null);
    const [isError, setIsError] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage(null);
        setIsError(false);

        try {
            const formData = new FormData(event.currentTarget);
            const result = await createOperationAction(formData);
            setMessage(
                result.success
                    ? 'Radnja je uspješno kreirana.'
                    : 'Došlo je do greške pri kreiranju radnje.',
            );
            setIsError(!result.success);
        } catch (error) {
            setMessage(
                error instanceof Error
                    ? error.message
                    : 'Došlo je do greške pri kreiranju radnje.',
            );
            setIsError(true);
        }
    };

    return (
        <Modal
            title={'Nova operacija'}
            trigger={
                <IconButton title="Nova operacija" variant="outlined">
                    <Add className="size-4" />
                </IconButton>
            }
        >
            <Stack spacing={8}>
                <Typography level="h5">Nova operacija</Typography>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Stack spacing={4}>
                        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                name="entityTypeName"
                                label="Tip entiteta"
                                defaultValue="operation"
                                required
                                hidden
                                fullWidth
                            />
                            <SelectEntity
                                name="entityId"
                                label="ID entiteta"
                                required
                                entityTypeName={'operation'}
                            />
                            <Input
                                name="accountId"
                                defaultValue={accountId}
                                label="Account ID"
                                required
                                fullWidth
                            />
                            <Input
                                name="gardenId"
                                defaultValue={gardenId}
                                label="Vrt ID (opcionalno)"
                                type="number"
                                fullWidth
                            />
                            <SelectRaisedBed
                                name="raisedBedId"
                                label="Gredica"
                                accountId={accountId}
                                gardenId={gardenId}
                                disableAbandoned
                                value={selectedRaisedBedId}
                                onChange={setSelectedRaisedBedId}
                                disabled={!gardenId}
                            />
                            <SelectRaisedBedField
                                name="raisedBedFieldId"
                                label="Polje gredice"
                                raisedBedId={
                                    selectedRaisedBedId
                                        ? parseInt(selectedRaisedBedId, 10)
                                        : undefined
                                }
                                gardenId={gardenId}
                                defaultValue={raisedBedFieldId?.toString()}
                                disabled={!selectedRaisedBedId}
                            />
                            <Input
                                name="timestamp"
                                type="datetime-local"
                                label="Datum kreiranja (opcionalno)"
                            />
                            <Input
                                name="scheduledDate"
                                type="datetime-local"
                                label="Planirani datum (opcionalno)"
                            />
                        </div>
                        {message && (
                            <Alert
                                color={isError ? 'danger' : 'success'}
                                startDecorator={
                                    isError ? (
                                        <Warning className="size-4 shrink-0" />
                                    ) : undefined
                                }
                            >
                                <Typography level="body2">{message}</Typography>
                            </Alert>
                        )}
                        <Button type="submit">Kreiraj</Button>
                    </Stack>
                </form>
            </Stack>
        </Modal>
    );
}
