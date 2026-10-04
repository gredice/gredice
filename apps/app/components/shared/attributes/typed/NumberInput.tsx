import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Add, Remove } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { useState } from 'react';
import type { AttributeInputProps } from '../AttributeInputProps';
import { attributeUnitDecorator } from './AttributeUnitDecorator';

export function NumberInput({
    value,
    onChange,
    attributeDefinition,
}: AttributeInputProps) {
    const [inputValue, setInputValue] = useState<string>(value || '');

    const handleIncrementDecrement = (inc: boolean) => {
        // Increment or decrement the value by least significant digit
        // eg. if value is 1, incrementing will make it 2
        // if value is 1.1, incrementing will make it 1.2
        // if value is 1.01, incrementing will make it 1.02
        let newValue = parseFloat(inputValue || '0');
        const leastSignificantDigit =
            inputValue.indexOf('.') !== -1
                ? 0.1 ** inputValue.split('.')[1].length
                : 1;
        newValue = inc
            ? newValue + leastSignificantDigit
            : newValue - leastSignificantDigit;

        setInputValue(newValue.toString());
        onChange(newValue.toString());
    };

    return (
        <Row className="items-stretch">
            <Button
                className="rounded-r-none h-auto border-r-0"
                variant="outlined"
                type="button"
                onClick={() => handleIncrementDecrement(false)}
            >
                <Remove className="size-4" />
            </Button>
            <Input
                className="w-28 rounded-none"
                placeholder={'NA'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={() => onChange(inputValue || null)}
                endDecorator={attributeUnitDecorator(attributeDefinition?.unit)}
            />
            <Button
                className="rounded-l-none h-auto border-l-0"
                variant="outlined"
                onClick={() => handleIncrementDecrement(true)}
            >
                <Add className="size-4" />
            </Button>
        </Row>
    );
}
