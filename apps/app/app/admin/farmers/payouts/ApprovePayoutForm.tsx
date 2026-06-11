'use client';

import { formatPrice } from '@gredice/js/currency';
import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Add, Delete } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState, useTransition } from 'react';
import {
    approvePayoutAction,
    rejectPayoutAction,
} from '../../../(actions)/payoutAdminActions';

type AdjustmentDraft = {
    id: number;
    label: string;
    amount: string;
};

function parseAmountInput(value: string) {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) {
        return null;
    }

    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : null;
}

function amountToCents(amount: number) {
    return Math.round(amount * 100);
}

function getAdjustmentInputError(adjustment: AdjustmentDraft): string | null {
    const hasLabel = adjustment.label.trim().length > 0;
    const hasAmount = adjustment.amount.trim().length > 0;

    if (!hasLabel && !hasAmount) {
        return null;
    }

    if (!hasLabel) {
        return 'Dodaj opis korekcije.';
    }

    const amount = parseAmountInput(adjustment.amount);
    if (amount === null) {
        return 'Unesi ispravan iznos korekcije.';
    }

    if (amountToCents(amount) === 0) {
        return 'Korekcija mora biti različita od nule.';
    }

    return null;
}

export function ApprovePayoutForm({
    id,
    requestedAmount,
}: {
    id: number;
    requestedAmount: string;
}) {
    const [note, setNote] = useState('');
    const [adjustments, setAdjustments] = useState<AdjustmentDraft[]>([]);
    const [nextAdjustmentId, setNextAdjustmentId] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const requestedAmountValue = parseAmountInput(requestedAmount) ?? 0;
    const requestedAmountCents = amountToCents(requestedAmountValue);
    const activeAdjustments = adjustments.filter(
        (adjustment) =>
            adjustment.label.trim().length > 0 ||
            adjustment.amount.trim().length > 0,
    );
    const adjustmentErrors = activeAdjustments
        .map((adjustment) => getAdjustmentInputError(adjustment))
        .filter((message): message is string => message !== null);
    const adjustmentTotalCents = activeAdjustments.reduce(
        (total, adjustment) => {
            const amount = parseAmountInput(adjustment.amount);
            if (amount === null) {
                return total;
            }

            return total + amountToCents(amount);
        },
        0,
    );
    const finalAmountCents = requestedAmountCents + adjustmentTotalCents;
    const finalAmount = finalAmountCents / 100;
    const hasInvalidAdjustment = adjustmentErrors.length > 0;
    const canApprove =
        !isPending && !hasInvalidAdjustment && finalAmountCents > 0;

    const addAdjustment = () => {
        setAdjustments((items) => [
            ...items,
            { id: nextAdjustmentId, label: '', amount: '' },
        ]);
        setNextAdjustmentId((value) => value + 1);
    };

    const updateAdjustment = (
        adjustmentId: number,
        field: 'label' | 'amount',
        value: string,
    ) => {
        setAdjustments((items) =>
            items.map((item) =>
                item.id === adjustmentId ? { ...item, [field]: value } : item,
            ),
        );
    };

    const removeAdjustment = (adjustmentId: number) => {
        setAdjustments((items) =>
            items.filter((item) => item.id !== adjustmentId),
        );
    };

    const handleApprove = () => {
        startTransition(async () => {
            setError(null);

            const parsedAdjustments: { label: string; amount: number }[] = [];
            for (const adjustment of activeAdjustments) {
                const amount = parseAmountInput(adjustment.amount);
                if (amount === null) {
                    return;
                }

                parsedAdjustments.push({
                    label: adjustment.label.trim(),
                    amount,
                });
            }

            try {
                await approvePayoutAction(
                    id,
                    note.trim() || undefined,
                    parsedAdjustments,
                );
            } catch (caughtError) {
                setError(
                    caughtError instanceof Error
                        ? caughtError.message
                        : 'Zahtjev za isplatu nije odobren.',
                );
            }
        });
    };

    return (
        <Stack spacing={2} className="min-w-80">
            <Input
                placeholder="Bilješka za farmera (neobavezno)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
            />
            <Stack spacing={1}>
                <Row justifyContent="space-between" spacing={2}>
                    <Typography level="body3" className="text-muted-foreground">
                        Zatraženo
                    </Typography>
                    <Typography level="body3" className="tabular-nums">
                        {formatPrice(requestedAmountValue)}
                    </Typography>
                </Row>
                <Row justifyContent="space-between" spacing={2}>
                    <Typography level="body3" className="text-muted-foreground">
                        Korekcije
                    </Typography>
                    <Typography level="body3" className="tabular-nums">
                        {formatPrice(adjustmentTotalCents / 100)}
                    </Typography>
                </Row>
                <Row justifyContent="space-between" spacing={2}>
                    <Typography level="body2" semiBold>
                        Za isplatu
                    </Typography>
                    <Typography level="body2" semiBold className="tabular-nums">
                        {formatPrice(finalAmount)}
                    </Typography>
                </Row>
            </Stack>

            {adjustments.map((adjustment) => (
                <Row key={adjustment.id} spacing={1} className="items-start">
                    <Input
                        placeholder="Opis korekcije"
                        value={adjustment.label}
                        onChange={(event) =>
                            updateAdjustment(
                                adjustment.id,
                                'label',
                                event.target.value,
                            )
                        }
                        maxLength={160}
                        className="min-w-0 flex-1"
                    />
                    <Input
                        placeholder="+10.00 ili -5.00"
                        value={adjustment.amount}
                        onChange={(event) =>
                            updateAdjustment(
                                adjustment.id,
                                'amount',
                                event.target.value,
                            )
                        }
                        inputMode="decimal"
                        className="w-32"
                    />
                    <Button
                        aria-label="Ukloni korekciju"
                        title="Ukloni korekciju"
                        size="sm"
                        variant="plain"
                        color="danger"
                        onClick={() => removeAdjustment(adjustment.id)}
                    >
                        <Delete className="size-4" />
                    </Button>
                </Row>
            ))}

            {adjustmentErrors[0] ? (
                <Typography level="body3" className="text-destructive">
                    {adjustmentErrors[0]}
                </Typography>
            ) : null}
            {finalAmountCents <= 0 ? (
                <Typography level="body3" className="text-destructive">
                    Konačni iznos isplate mora biti veći od nule.
                </Typography>
            ) : null}
            {error ? (
                <Typography level="body3" className="text-destructive">
                    {error}
                </Typography>
            ) : null}

            <Row spacing={1}>
                <Button
                    size="sm"
                    variant="outlined"
                    onClick={addAdjustment}
                    startDecorator={<Add className="size-4" />}
                >
                    Korekcija
                </Button>
                <Button
                    size="sm"
                    disabled={!canApprove}
                    onClick={handleApprove}
                >
                    {isPending ? 'Obrađuje se...' : 'Odobri'}
                </Button>
            </Row>
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
