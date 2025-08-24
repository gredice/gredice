'use client';

import { Add } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useActionState, useRef } from 'react';
import { createNotificationAction } from '../../app/(actions)/notificationActions';

type NotificationCreateModalProps = {
    accountId?: string;
    userId?: string;
    gardenId?: number;
    raisedBedId?: number;
};

export function NotificationCreateModal({
    accountId,
    userId,
    gardenId,
    raisedBedId,
}: NotificationCreateModalProps) {
    const [state, formAction, pending] = useActionState(
        createNotificationAction,
        null,
    );
    const formRef = useRef<HTMLFormElement>(null);

    return (
        <Modal
            trigger={
                <IconButton title="Nova obavijest">
                    <Add className="size-5" />
                </IconButton>
            }
            title={'Nova obavijest'}
        >
            <Stack spacing={4}>
                <Typography level="h5">Nova obavijest</Typography>
                <form ref={formRef} action={formAction} className="space-y-4">
                    <Stack spacing={2}>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                name="header"
                                label="Naslov"
                                required
                                disabled={pending}
                                className="col-span-2"
                            />
                            <Input
                                name="content"
                                label="Sadržaj"
                                required
                                disabled={pending}
                                className="col-span-2"
                            />
                            <Input
                                name="iconUrl"
                                label="URL ikone (opcionalno)"
                                disabled={pending}
                            />
                            <Input
                                name="imageUrl"
                                label="URL slike (opcionalno)"
                                disabled={pending}
                            />
                            <Input
                                name="linkUrl"
                                label="Link (opcionalno)"
                                disabled={pending}
                            />
                            <Input
                                name="accountId"
                                defaultValue={accountId}
                                label="Account ID"
                                required
                                disabled={pending}
                            />
                            <Input
                                name="userId"
                                defaultValue={userId}
                                label="Korisnik ID (opcionalno)"
                                disabled={pending}
                            />
                            <Input
                                name="gardenId"
                                defaultValue={gardenId}
                                label="Vrt ID (opcionalno)"
                                type="number"
                                disabled={pending}
                            />
                            <Input
                                name="raisedBedId"
                                defaultValue={raisedBedId}
                                label="Gredica ID (opcionalno)"
                                disabled={pending}
                            />
                            <Input
                                name="blockId"
                                label="Blok ID (opcionalno)"
                                disabled={pending}
                            />
                            <Input
                                name="timestamp"
                                type="datetime-local"
                                label="Datum kreiranja (opcionalno)"
                                disabled={pending}
                            />
                        </div>
                        <Button
                            type="submit"
                            loading={pending}
                            disabled={pending}
                        >
                            Pošalji
                        </Button>
                    </Stack>
                    {state?.success && (
                        <div className="text-green-600 mt-2">
                            Obavijest uspešno poslana!
                        </div>
                    )}
                </form>
            </Stack>
        </Modal>
    );
}
