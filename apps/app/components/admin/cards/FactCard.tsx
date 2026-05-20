import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { cx } from '@signalco/ui-primitives/cx';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@signalco/ui-primitives/Tooltip';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { ReactNode } from 'react';

export function FactCard({
    header,
    value,
    href,
    beforeValue,
}: {
    header: string;
    value: ReactNode;
    href?: string;
    beforeValue?: string | number;
}) {
    const numericValue =
        typeof value === 'number'
            ? value
            : typeof value === 'string'
              ? Number(value)
              : Number.NaN;
    const hasComparableValue = Number.isFinite(numericValue);
    const hasChange =
        typeof beforeValue !== 'undefined' &&
        hasComparableValue &&
        Number.isFinite(Number(beforeValue));
    const change = hasChange
        ? Number(beforeValue) > 0
            ? ((numericValue - Number(beforeValue)) / Number(beforeValue)) * 100
            : numericValue * 100
        : 0;
    const changeText = hasChange
        ? `${change > 0 ? '+' : ''}${change.toFixed(1)}%`
        : '';
    const changeCount = hasChange ? numericValue - Number(beforeValue) : 0;
    const changeCountText = changeCount > 0 ? `+${changeCount}` : changeCount;

    return (
        <Card href={href}>
            <CardOverflow>
                <Row className="p-2" spacing={1} justifyContent="space-between">
                    <Stack>
                        <Typography level="body3">{header}</Typography>
                        <Typography level="h4" semiBold>
                            {value}
                        </Typography>
                    </Stack>
                    {hasChange && (
                        <Stack className="self-end">
                            <Tooltip>
                                <TooltipTrigger>
                                    <Typography
                                        level="body1"
                                        className={cx(
                                            change > 0
                                                ? 'text-green-600'
                                                : change < 0
                                                  ? 'text-red-600'
                                                  : '',
                                            'cursor-help text-right',
                                        )}
                                    >
                                        {changeCountText}
                                        <small>{` (${changeText})`}</small>
                                    </Typography>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <Typography>
                                        {changeCount > 0 ? '+' : ''}
                                        {changeCount} u odabranom vremenskom
                                        periodu
                                    </Typography>
                                </TooltipContent>
                            </Tooltip>
                        </Stack>
                    )}
                </Row>
            </CardOverflow>
        </Card>
    );
}
