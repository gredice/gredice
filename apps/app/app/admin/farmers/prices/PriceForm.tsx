'use client';

import type { SelectFarm } from '@gredice/storage';
import type { SelectEntityType } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState, useTransition } from 'react';
import {
    deleteOperationPriceAction,
    setOperationPriceAction,
} from '../../../(actions)/payoutAdminActions';

type CurrentPrice = {
    id: number;
    farmId: number;
    entityTypeName: string;
    pricePerUnit: string;
    currency: string;
};

export function PriceRow({
    farm,
    entityType,
    currentPrice,
}: {
    farm: SelectFarm;
    entityType: SelectEntityType;
    currentPrice?: CurrentPrice;
}) {
    const [value, setValue] = useState(currentPrice?.pricePerUnit ?? '');
    const [isPending, startTransition] = useTransition();

    const handleSave = () => {
        if (!value.trim()) return;
        startTransition(async () => {
            await setOperationPriceAction(
                farm.id,
                entityType.name,
                value.trim(),
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
        <Row spacing={3} className="items-center py-2 border-b last:border-b-0">
            <div className="flex-1 min-w-0">
                <Typography level="body2" semiBold>
                    {entityType.label}
                </Typography>
                <Typography level="body3" className="text-muted-foreground font-mono">
                    {entityType.name}
                </Typography>
            </div>
            <Row spacing={2} className="items-center shrink-0">
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
