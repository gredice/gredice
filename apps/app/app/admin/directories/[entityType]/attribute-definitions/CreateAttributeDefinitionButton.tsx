'use client';

import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import { Add } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
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
            <Stack spacing={4}>
                <Stack spacing={2}>
                    <Typography level="h5">Novi atribut</Typography>
                    <Typography level="body2">
                        Unesite podatke za novi atribut.
                    </Typography>
                </Stack>
                <form action={submitForm}>
                    <Stack spacing={8}>
                        <Stack spacing={2}>
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
                                <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                                    <Input
                                        type="number"
                                        name="rangeMin"
                                        label="Minimalna vrijednost"
                                        value={rangeMinValue}
                                        onChange={(event) =>
                                            setRangeMinValue(event.target.value)
                                        }
                                        fullWidth
                                    />
                                    <Input
                                        type="number"
                                        name="rangeMax"
                                        label="Maksimalna vrijednost"
                                        value={rangeMaxValue}
                                        onChange={(event) =>
                                            setRangeMaxValue(event.target.value)
                                        }
                                        fullWidth
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
