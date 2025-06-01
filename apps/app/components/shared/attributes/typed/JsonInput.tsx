import { ComponentType, useState } from 'react';
import { Stack } from '@signalco/ui-primitives/Stack';
import { camelToSentenceCase } from '@signalco/js';
import { Typography } from '@signalco/ui-primitives/Typography';
import { Card } from '@signalco/ui-primitives/Card';
import { AttributeInputProps } from '../AttributeInputProps';
import { TextInput } from './TextInput';
import { BooleanInput } from './BooleanInput';
import { NumberInput } from './NumberInput';
import dynamic from 'next/dynamic';
import { Skeleton } from '@signalco/ui-primitives/Skeleton';
import { unwrapSchema } from '@gredice/js/jsonSchema';
import { BarcodeInput } from './BarcodeInput';

const MarkdownInput = dynamic(() => import('./MarkdownInput').then(mod => ({
    default: mod.MarkdownInput
})), {
    ssr: false,
    loading: () => <Skeleton className='w-full h-40' />
});

export function JsonInput({ value, onChange, schema }: AttributeInputProps) {
    const [inputValue, setInputValue] = useState<Record<string, unknown>>(JSON.parse(value ?? '{}'));

    const handleOnChange = (newValue: Record<string, unknown>) => {
        setInputValue(newValue);
        onChange(JSON.stringify(newValue));
    }

    const schemaUnwrapped = typeof schema === 'string' ? unwrapSchema(schema ?? '') : (schema ?? {});

    return (
        <Card>
            <Stack spacing={1}>
                {Object.keys(schemaUnwrapped).map((key) => {
                    let InputComponent: ComponentType<AttributeInputProps> = TextInput;
                    if (schemaUnwrapped[key] === 'string') {
                        InputComponent = TextInput;
                    } else if (schemaUnwrapped[key] === 'number') {
                        InputComponent = NumberInput;
                    } else if (schemaUnwrapped[key] === 'boolean') {
                        InputComponent = BooleanInput;
                    } else if (schemaUnwrapped[key] === 'markdown') {
                        InputComponent = MarkdownInput;
                    } else if (schemaUnwrapped[key] === 'barcode') {
                        InputComponent = BarcodeInput;
                    } else if (typeof schemaUnwrapped[key] === 'object') {
                        InputComponent = JsonInput;
                    } else {
                        return (
                            <Typography key={key} level='body2' className='bg-red-600 text-white rounded-md p-4'>
                                Type {typeof schemaUnwrapped[key]} not supported
                            </Typography>
                        )
                    }

                    return (
                        <Stack spacing={0.5} key={key}>
                            <Typography level='body2'>
                                {camelToSentenceCase(key)}
                            </Typography>
                            <InputComponent
                                value={typeof inputValue[key] === 'string'
                                    ? inputValue[key]
                                    : JSON.stringify(inputValue[key])}
                                onChange={(newValue: string | null) => {
                                    handleOnChange({ ...inputValue, [key]: newValue });
                                }}
                            />
                        </Stack>
                    );
                })}
            </Stack>
        </Card>
    );
}
