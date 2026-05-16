'use client';

import { Add } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { upsertAttributeDefinition } from '../../../../(actions)/definitionActions';
import {
    attributeDataTypeItems,
    buildRangeDataType,
} from './AttributeDataTypes';

export function CreateAttributeDefinitionButton({
    entityTypeName,
    categoryName,
}: {
    entityTypeName: string;
    categoryName: string;
}) {
    const [selectedDataType, setSelectedDataType] = useState(
        attributeDataTypeItems[0].value,
    );
    const [rangeMinValue, setRangeMinValue] = useState('0');
    const [rangeMaxValue, setRangeMaxValue] = useState('100');

    async function submitForm(formData: FormData) {
        const name = formData.get('name') as string;
        const label = formData.get('label') as string;
        const defaultValue = formData.get('defaultValue') as string;
        const unit = formData.get('unit') as string;
        const dataType =
            selectedDataType === 'range'
                ? buildRangeDataType(rangeMinValue, rangeMaxValue)
                : selectedDataType;

        await upsertAttributeDefinition({
            name,
            label,
            dataType,
            defaultValue: defaultValue.length > 0 ? defaultValue : null,
            unit: unit.length > 0 ? unit : null,
            entityTypeName,
            category: categoryName,
        });
    }

    return (
        <Modal
            trigger={
                <IconButton variant="plain" title="Dodaj atribut">
                    <Add className="size-5" />
                </IconButton>
            }
            title="Nova definicija"
        >
            <Stack spacing={2}>
                <Stack spacing={1}>
                    <Typography level="h5">Novi atribut</Typography>
                    <Typography level="body2">
                        Unesite podatke za novi atribut.
                    </Typography>
                </Stack>
                <form action={submitForm}>
                    <Stack spacing={4}>
                        <Stack spacing={1}>
                            <Input name="name" label="Naziv" />
                            <Input name="label" label="Labela" />
                            <SelectItems
                                name="dataType"
                                label="Vrsta podatka"
                                value={selectedDataType}
                                items={attributeDataTypeItems}
                                onValueChange={setSelectedDataType}
                            />
                            {selectedDataType === 'range' && (
                                <div className="grid grid-cols-2 gap-2">
                                    <Input
                                        type="number"
                                        name="rangeMin"
                                        label="Minimalna vrijednost"
                                        value={rangeMinValue}
                                        onChange={(event) =>
                                            setRangeMinValue(event.target.value)
                                        }
                                    />
                                    <Input
                                        type="number"
                                        name="rangeMax"
                                        label="Maksimalna vrijednost"
                                        value={rangeMaxValue}
                                        onChange={(event) =>
                                            setRangeMaxValue(event.target.value)
                                        }
                                    />
                                </div>
                            )}
                            <Input
                                name="defaultValue"
                                label="Zadana vrijednost"
                                placeholder="-"
                            />
                            <Input
                                name="unit"
                                label="Jedinica"
                                placeholder="°C, €, cm"
                            />
                        </Stack>
                        <Button variant="solid" type="submit">
                            Kreiraj
                        </Button>
                    </Stack>
                </form>
            </Stack>
        </Modal>
    );
}
