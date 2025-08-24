import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import { useState } from 'react';
import type { AttributeInputProps } from '../AttributeInputProps';
import { BarcodeScanButton } from './BarcodeScanButton';

export function BarcodeInput({ value, onChange }: AttributeInputProps) {
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
        <Row spacing={1}>
            <Input
                placeholder={'Nema informacija...'}
                value={inputValue}
                onChange={(e) => handleOnChange(e.target.value)}
                onBlur={handleOnBlur}
                fullWidth
            />
            <BarcodeScanButton onScan={handleScan} />
        </Row>
    );
}