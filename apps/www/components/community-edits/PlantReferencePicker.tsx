'use client';

import { Chip } from '@gredice/ui/Chip';
import { Close } from '@gredice/ui/icons';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Typography } from '@gredice/ui/Typography';
import { useMemo } from 'react';

type PlantReferenceOption = {
    value: string;
    label: string;
};

export function PlantReferencePicker({
    id,
    label,
    onValueChange,
    options,
    selectedValues,
}: {
    id: string;
    label: string;
    onValueChange: (values: string[]) => void;
    options: PlantReferenceOption[];
    selectedValues: string[];
}) {
    const optionByValue = useMemo(
        () => new Map(options.map((option) => [option.value, option])),
        [options],
    );
    const selectedValueSet = useMemo(
        () => new Set(selectedValues),
        [selectedValues],
    );
    const availableOptions = options.filter(
        (option) => !selectedValueSet.has(option.value),
    );
    const selectedOptions = selectedValues.map(
        (value) =>
            optionByValue.get(value) ?? {
                value,
                label: `Biljka ${value}`,
            },
    );

    return (
        <div className="space-y-3">
            <SelectItems
                disabled={availableOptions.length === 0}
                emptySearchText="Nema biljaka za taj pojam."
                id={id}
                items={availableOptions}
                onValueChange={(value) => {
                    if (value) {
                        onValueChange([...selectedValues, value]);
                    }
                }}
                placeholder={
                    availableOptions.length > 0
                        ? `Dodaj biljku — ${label}`
                        : 'Nema više dostupnih biljaka'
                }
                searchable
                searchPlaceholder="Pretraži biljke..."
                value=""
            />
            <fieldset className="flex min-h-9 flex-wrap items-center gap-2">
                <legend className="sr-only">Odabrane biljke — {label}</legend>
                {selectedOptions.length > 0 ? (
                    selectedOptions.map((option) => (
                        <Chip
                            aria-label={`Ukloni biljku ${option.label}`}
                            key={option.value}
                            onClick={() =>
                                onValueChange(
                                    selectedValues.filter(
                                        (value) => value !== option.value,
                                    ),
                                )
                            }
                            size="sm"
                            variant="soft"
                        >
                            <span className="max-w-52 truncate">
                                {option.label}
                            </span>
                            <Close aria-hidden className="size-3" />
                        </Chip>
                    ))
                ) : (
                    <Typography level="body3" className="text-muted-foreground">
                        Nema odabranih biljaka.
                    </Typography>
                )}
            </fieldset>
        </div>
    );
}
