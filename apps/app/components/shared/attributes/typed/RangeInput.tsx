import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import { useMemo, useState } from 'react';
import type { AttributeInputProps } from '../AttributeInputProps';

function parseRangeDefinition(dataType: string | undefined): {
    minBound: number;
    maxBound: number;
} {
    const [, minRaw, maxRaw] = (dataType ?? '').split('|');
    const parsedMin = Number.parseFloat(minRaw ?? '');
    const parsedMax = Number.parseFloat(maxRaw ?? '');
    return {
        minBound: Number.isNaN(parsedMin) ? 0 : parsedMin,
        maxBound: Number.isNaN(parsedMax) ? 100 : parsedMax,
    };
}

function parseValue(value: string | null | undefined): {
    min: string;
    max: string;
} {
    if (!value) {
        return { min: '', max: '' };
    }

    try {
        const parsedValue = JSON.parse(value) as unknown;
        if (
            parsedValue &&
            typeof parsedValue === 'object' &&
            'min' in parsedValue &&
            'max' in parsedValue
        ) {
            const minValue = parsedValue.min;
            const maxValue = parsedValue.max;
            return {
                min: typeof minValue === 'number' ? minValue.toString() : '',
                max: typeof maxValue === 'number' ? maxValue.toString() : '',
            };
        }
    } catch {
        // Ignore invalid values and fallback to empty input
    }

    return { min: '', max: '' };
}

export function RangeInput({
    value,
    onChange,
    attributeDefinition,
}: AttributeInputProps) {
    const initialValue = useMemo(() => parseValue(value), [value]);
    const [rangeMinValue, setRangeMinValue] = useState(initialValue.min);
    const [rangeMaxValue, setRangeMaxValue] = useState(initialValue.max);
    const bounds = parseRangeDefinition(attributeDefinition?.dataType);

    const handleBlur = () => {
        if (rangeMinValue.length === 0 || rangeMaxValue.length === 0) {
            onChange(null);
            return;
        }

        onChange(
            JSON.stringify({
                min: Number.parseFloat(rangeMinValue),
                max: Number.parseFloat(rangeMaxValue),
            }),
        );
    };

    return (
        <Row className="gap-2">
            <Input
                className="w-24"
                type="number"
                label="Min"
                placeholder={'NA'}
                min={bounds.minBound}
                max={bounds.maxBound}
                value={rangeMinValue}
                onChange={(event) => setRangeMinValue(event.target.value)}
                onBlur={handleBlur}
                endDecorator={attributeDefinition?.unit}
            />
            <Input
                className="w-24"
                type="number"
                label="Maks"
                placeholder={'NA'}
                min={bounds.minBound}
                max={bounds.maxBound}
                value={rangeMaxValue}
                onChange={(event) => setRangeMaxValue(event.target.value)}
                onBlur={handleBlur}
                endDecorator={attributeDefinition?.unit}
            />
        </Row>
    );
}
