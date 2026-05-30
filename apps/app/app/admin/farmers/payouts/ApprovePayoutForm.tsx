'use client';

import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Stack } from '@gredice/ui/Stack';
import { useState, useTransition } from 'react';
import {
    approvePayoutAction,
    rejectPayoutAction,
} from '../../../(actions)/payoutAdminActions';

export function ApprovePayoutForm({ id }: { id: number }) {
    const [note, setNote] = useState('');
    const [isPending, startTransition] = useTransition();

    const handleApprove = () => {
        startTransition(async () => {
            await approvePayoutAction(id, note.trim() || undefined);
        });
    };

    return (
        <Stack spacing={2}>
            <Input
                placeholder="Bilješka za farmera (neobavezno)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                className="w-56"
            />
            <Button size="sm" disabled={isPending} onClick={handleApprove}>
                {isPending ? 'Obrađuje se...' : 'Odobri'}
            </Button>
        </Stack>
    );
}

export function RejectPayoutForm({ id }: { id: number }) {
    const [reason, setReason] = useState('');
    const [isPending, startTransition] = useTransition();

    const handleReject = () => {
        startTransition(async () => {
            await rejectPayoutAction(id, reason.trim() || undefined);
        });
    };

    return (
        <Stack spacing={2}>
            <Input
                placeholder="Razlog odbijanja (neobavezno)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                className="w-56"
            />
            <Button
                size="sm"
                variant="outlined"
                disabled={isPending}
                onClick={handleReject}
            >
                {isPending ? 'Obrađuje se...' : 'Odbij'}
            </Button>
        </Stack>
    );
}
