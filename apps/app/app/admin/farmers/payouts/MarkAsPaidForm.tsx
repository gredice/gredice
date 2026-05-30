'use client';

import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { useState, useTransition } from 'react';
import { markPayoutAsPaidAction } from '../../../(actions)/payoutAdminActions';

export function MarkAsPaidForm({
    id,
    farmerName,
}: {
    id: number;
    farmerName: string;
}) {
    const [open, setOpen] = useState(false);
    const [bankRef, setBankRef] = useState('');
    const [isPending, startTransition] = useTransition();

    if (!open) {
        return (
            <Button size="sm" onClick={() => setOpen(true)}>
                Označi plaćenim
            </Button>
        );
    }

    return (
        <Stack spacing={2} className="min-w-48">
            <Input
                placeholder="Referenca bankovnog prijenosa"
                value={bankRef}
                onChange={(e) => setBankRef(e.target.value)}
            />
            <Row spacing={2}>
                <Button
                    size="sm"
                    disabled={!bankRef.trim() || isPending}
                    onClick={() =>
                        startTransition(async () => {
                            await markPayoutAsPaidAction(
                                id,
                                bankRef.trim(),
                                farmerName,
                            );
                            setOpen(false);
                        })
                    }
                >
                    Potvrdi
                </Button>
                <Button
                    size="sm"
                    variant="outlined"
                    onClick={() => setOpen(false)}
                >
                    Odustani
                </Button>
            </Row>
        </Stack>
    );
}
