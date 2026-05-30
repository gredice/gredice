'use client';

import { formatPrice } from '@gredice/js/currency';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Input } from '@gredice/ui/Input';
import { Row } from '@gredice/ui/Row';
import { Typography } from '@gredice/ui/Typography';
import { useState, useTransition } from 'react';
import {
    deleteOperationPriceAction,
    setOperationPriceAction,
} from '../../../(actions)/payoutAdminActions';

export type CurrentPrice = {
    id: number;
    pricePerUnit: string;
    currency: string;
};

type PriceRange = {
    min: number;
    max: number;
};

function parsePrice(value: string) {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) {
        return null;
    }

    const price = Number.parseFloat(normalized);
    return Number.isFinite(price) ? price : null;
}

function formatPriceRange(priceRange: PriceRange) {
    if (priceRange.min === priceRange.max) {
        return formatPrice(priceRange.min);
    }

    return `${formatPrice(priceRange.min)} - ${formatPrice(priceRange.max)}`;
}

export function PriceRow({
    farmId,
    entityTypeName,
    entityId,
    label,
    sublabel,
    userFacingPrice,
    userFacingPriceRange,
    userFacingPriceNote,
    isInternalOperation = false,
    currentPrice,
}: {
    farmId: number;
    entityTypeName: string;
    entityId?: number | null;
    label: string;
    sublabel?: string;
    userFacingPrice?: number | null;
    userFacingPriceRange?: PriceRange | null;
    userFacingPriceNote?: string;
    isInternalOperation?: boolean;
    currentPrice?: CurrentPrice;
}) {
    const [value, setValue] = useState(currentPrice?.pricePerUnit ?? '');
    const [isPending, startTransition] = useTransition();
    const farmerPrice = parsePrice(value);
    const hasUserFacingPrice = typeof userFacingPrice === 'number';
    const hasUserFacingPriceRange =
        userFacingPriceRange !== null && userFacingPriceRange !== undefined;
    const comparisonUserFacingPrice = hasUserFacingPrice
        ? userFacingPrice
        : userFacingPriceRange?.min;
    const userFacingPriceIsMissing =
        userFacingPrice === null || userFacingPriceRange === null;
    const showFarmerPriceWarning =
        typeof comparisonUserFacingPrice === 'number' &&
        farmerPrice !== null &&
        farmerPrice > comparisonUserFacingPrice &&
        !(isInternalOperation && comparisonUserFacingPrice === 0);
    const farmerPriceWarningTitle = hasUserFacingPriceRange
        ? 'Cijena farmera je veća od najniže korisničke cijene.'
        : 'Cijena farmera je veća od korisničke cijene.';

    const handleSave = () => {
        const trimmed = value.trim().replace(',', '.');
        if (!trimmed) return;
        startTransition(async () => {
            await setOperationPriceAction(
                farmId,
                entityTypeName,
                trimmed,
                entityId ?? null,
            );
        });
    };

    const handleDelete = () => {
        if (!currentPrice) return;
        startTransition(async () => {
            await deleteOperationPriceAction(currentPrice.id);
            setValue('');
        });
    };

    return (
        <Row
            spacing={3}
            className="items-start border-b py-3 last:border-b-0 max-lg:flex-wrap"
        >
            <div className="flex-1 min-w-0">
                <Row spacing={1.5} className="min-w-0 flex-wrap items-center">
                    <Typography level="body2" semiBold>
                        {label}
                    </Typography>
                    {!currentPrice && (
                        <Chip color="warning" size="sm" variant="soft">
                            Farmer nije definiran
                        </Chip>
                    )}
                    {isInternalOperation && (
                        <Chip color="info" size="sm" variant="soft">
                            Interna radnja
                        </Chip>
                    )}
                    {showFarmerPriceWarning && (
                        <Chip
                            color="warning"
                            size="sm"
                            title={farmerPriceWarningTitle}
                            variant="solid"
                        >
                            Farmer &gt; korisnik
                        </Chip>
                    )}
                </Row>
                {sublabel && (
                    <Typography
                        level="body3"
                        className="text-muted-foreground font-mono"
                    >
                        {sublabel}
                    </Typography>
                )}
            </div>
            <div className="min-w-40 shrink-0">
                <Typography level="body3" className="text-muted-foreground">
                    Korisnička cijena
                </Typography>
                {hasUserFacingPrice ? (
                    <Typography level="body2" semiBold className="tabular-nums">
                        {formatPrice(userFacingPrice)}
                    </Typography>
                ) : hasUserFacingPriceRange ? (
                    <Typography level="body2" semiBold className="tabular-nums">
                        {formatPriceRange(userFacingPriceRange)}
                    </Typography>
                ) : userFacingPriceIsMissing ? (
                    <Chip color="warning" size="sm" variant="soft">
                        Korisnik nije definiran
                    </Chip>
                ) : (
                    <Typography level="body3" className="text-muted-foreground">
                        {userFacingPriceNote ?? 'Nije primjenjivo'}
                    </Typography>
                )}
                {(hasUserFacingPrice || hasUserFacingPriceRange) &&
                    userFacingPriceNote && (
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            {userFacingPriceNote}
                        </Typography>
                    )}
            </div>
            <Row
                spacing={2}
                className="w-full shrink-0 items-center justify-end lg:w-auto"
            >
                <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-28 tabular-nums"
                />
                <Typography level="body3" className="text-muted-foreground">
                    EUR / radnja
                </Typography>
                <Button
                    size="sm"
                    disabled={!value.trim() || isPending}
                    onClick={handleSave}
                >
                    Spremi
                </Button>
                {currentPrice && (
                    <Button
                        size="sm"
                        variant="outlined"
                        disabled={isPending}
                        onClick={handleDelete}
                    >
                        Ukloni
                    </Button>
                )}
            </Row>
        </Row>
    );
}
