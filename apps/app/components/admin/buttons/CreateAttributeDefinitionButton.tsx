'use client';

import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import { Add } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { upsertAttributeDefinition } from '../../../app/(actions)/definitionActions';
import {
    attributeDataTypeItems,
    buildRangeDataType,
} from '../../../app/admin/directories/[entityType]/attribute-definitions/AttributeDataTypes';
import { KnownPages } from '../../../src/KnownPages';

export function CreateAttributeDefinitionButton({
    entityTypeName,
    categoryName,
}: {
    entityTypeName: string;
    categoryName: string;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [label, setLabel] = useState('');
    const [selectedDataType, setSelectedDataType] = useState<string>(
        attributeDataTypeItems[0].value,
    );
    const [rangeMinValue, setRangeMinValue] = useState('0');
    const [rangeMaxValue, setRangeMaxValue] = useState('100');
    const [submitting, setSubmitting] = useState(false);

    function resetForm() {
        setName('');
        setLabel('');
        setSelectedDataType(attributeDataTypeItems[0].value);
        setRangeMinValue('0');
        setRangeMaxValue('100');
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting) return;
        const dataType =
            selectedDataType === 'range'
                ? buildRangeDataType(rangeMinValue, rangeMaxValue)
                : selectedDataType;
        setSubmitting(true);
        try {
            const { id } = await upsertAttributeDefinition({
                name,
                label,
                dataType,
                entityTypeName,
                category: categoryName,
            });
            setOpen(false);
            resetForm();
            router.push(
                KnownPages.DirectoryEntityTypeAttributeDefinition(
                    entityTypeName,
                    id,
                ),
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) {
                    resetForm();
                }
            }}
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
                <form onSubmit={handleSubmit}>
                    <Stack spacing={8}>
                        <Stack spacing={2}>
                            <Input
                                name="name"
                                label="Naziv"
                                value={name}
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                            />
                            <Input
                                name="label"
                                label="Labela"
                                value={label}
                                onChange={(event) =>
                                    setLabel(event.target.value)
                                }
                            />
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
                        </Stack>
                        <Button
                            variant="solid"
                            type="submit"
                            loading={submitting}
                            disabled={submitting}
                        >
                            Kreiraj
                        </Button>
                    </Stack>
                </form>
            </Stack>
        </Modal>
    );
}
