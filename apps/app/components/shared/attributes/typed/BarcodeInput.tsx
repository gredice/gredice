import { Input } from '@gredice/ui/Input';
import { Row } from '@gredice/ui/Row';
import { useState } from 'react';
import type { AttributeInputProps } from '../AttributeInputProps';
import { attributeUnitDecorator } from './AttributeUnitDecorator';
import { BarcodeScanButton } from './BarcodeScanButton';

export function BarcodeInput({
    value,
    onChange,
    attributeDefinition,
}: AttributeInputProps) {
    const [inputValue, setInputValue] = useState<string>(value || '');
    function handleOnChange(newValue: string) {
        setInputValue(newValue);
    }
    function handleOnBlur() {
        onChange(inputValue || null);
    }
    function handleScan(value: string) {
        setInputValue(value);
        onChange(value || null);
    }
    return (
        <Row spacing={2}>
            <Input
                placeholder={'Nema informacija...'}
                value={inputValue}
                onChange={(e) => handleOnChange(e.target.value)}
                onBlur={handleOnBlur}
                fullWidth
                endDecorator={attributeUnitDecorator(attributeDefinition?.unit)}
            />
            <BarcodeScanButton onScan={handleScan} />
        </Row>
    );
}
