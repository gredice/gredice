'use client';

import { useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardActions } from "@signalco/ui-primitives/Card";
import { Input } from "@signalco/ui-primitives/Input";
import { Button } from "@signalco/ui-primitives/Button";
import { useActionState } from "react";
import { createNotificationAction } from "../app/(actions)/notificationActions";

export function NotificationCreateCard({ accountId, userId, gardenId }: { accountId?: string; userId?: string, gardenId?: number }) {
    const [state, formAction, pending] = useActionState(createNotificationAction, null);
    const formRef = useRef<HTMLFormElement>(null);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Kreiraj notifikaciju</CardTitle>
            </CardHeader>
            <form ref={formRef} action={formAction} className="space-y-4">
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input name="header" label="Naslov" required disabled={pending} className="col-span-2" />
                        <Input name="content" label="Sadržaj" required disabled={pending} className="col-span-2" />
                        <Input name="imageUrl" label="URL slike" disabled={pending} />
                        <Input name="linkUrl" label="Link (opcionalno)" disabled={pending} />
                        <Input name="accountId" defaultValue={accountId} label="Account ID" required disabled={pending} />
                        <Input name="userId" defaultValue={userId} label="User ID (opcionalno)" disabled={pending} />
                        <Input name="gardenId" defaultValue={gardenId} label="Garden ID (opcionalno)" type="number" disabled={pending} />
                        <Input name="blockId" label="Block ID (opcionalno)" disabled={pending} />
                    </div>
                    <CardActions>
                        <Button type="submit" loading={pending} disabled={pending}>
                            Kreiraj
                        </Button>
                    </CardActions>
                </CardContent>
                {state?.success && (
                    <div className="text-green-600 mt-2">Notifikacija uspešno kreirana!</div>
                )}
            </form>
        </Card>
    );
}