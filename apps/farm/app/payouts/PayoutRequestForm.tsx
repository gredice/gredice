'use client';

import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState, useTransition } from 'react';
import { requestPayoutAction } from '../(actions)/payoutActions';

export function PayoutRequestForm({
    farmId,
    availableBalance,
    currency,
}: {
    farmId: number;
    availableBalance: number;
    currency: string;
}) {
    const [amount, setAmount] = useState(availableBalance.toFixed(2));
    const [note, setNote] = useState('');
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const currencyLabel = currency.toUpperCase();
    const parsedAmount = parseFloat(amount);
    const isValid =
        !Number.isNaN(parsedAmount) &&
        parsedAmount > 0 &&
        parsedAmount <= availableBalance + 0.001;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
            try {
                await requestPayoutAction(
                    farmId,
                    parsedAmount,
                    currency,
                    note.trim() || undefined,
                );
                setSuccess(true);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Greška pri slanju zahtjeva.',
                );
            }
        });
    };

    if (success) {
        return (
            <Stack spacing={2} className="p-4 rounded-lg bg-green-50 border border-green-200">
                <Typography level="body2" semiBold className="text-green-800">
                    Zahtjev za isplatu uspješno poslan!
                </Typography>
                <Typography level="body3" className="text-green-700">
                    Administrator će pregledati tvoj zahtjev i obavijestiti te o
                    isplati.
                </Typography>
                <Button
                    variant="soft"
                    size="sm"
                    onClick={() => {
                        setSuccess(false);
                        setAmount(availableBalance.toFixed(2));
                        setNote('');
                    }}
                >
                    Pošalji još jedan zahtjev
                </Button>
            </Stack>
        );
    }

    return (
        <form onSubmit={handleSubmit}>
            <Stack spacing={4}>
                <Stack spacing={2}>
                    <Typography level="body2" semiBold>
                        Iznos isplate ({currencyLabel})
                    </Typography>
                    <Row spacing={2} className="items-center">
                        <Input
                            type="number"
                            min="0.01"
                            max={availableBalance.toFixed(2)}
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-36 tabular-nums"
                            required
                        />
                        <Typography level="body3" className="text-muted-foreground">
                            {currencyLabel} (max{' '}
                            {availableBalance.toFixed(2)} {currencyLabel})
                        </Typography>
                    </Row>
                </Stack>
                <Stack spacing={2}>
                    <Typography level="body2" semiBold>
                        Napomena (neobavezno)
                    </Typography>
                    <Input
                        placeholder="Npr. bankovni račun ili kontakt..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={500}
                    />
                </Stack>
                {error && (
                    <Typography level="body3" className="text-red-600">
                        {error}
                    </Typography>
                )}
                <Button
                    type="submit"
                    disabled={!isValid || isPending}
                    variant="solid"
                >
                    {isPending ? 'Slanje...' : 'Zatraži isplatu'}
                </Button>
            </Stack>
        </form>
    );
}
