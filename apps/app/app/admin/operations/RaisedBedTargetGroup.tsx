'use client';

import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { ExpandDown } from '@gredice/ui/icons';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { useState } from 'react';
import {
    isAdvancedSowingPlantOperationTargetBlocked,
    type OperationTargetScope,
} from './operationScope';

export type OperationTargetRaisedBed = {
    id: number;
    name?: string | null;
    physicalId?: string | null;
    accountId?: string | null;
    gardenId?: number | null;
    fields: Array<{
        id: number;
        positionIndex: number;
        hasActiveSelectedPlanting: boolean;
    }>;
};

type RaisedBedTargetGroupProps = {
    name: string;
    raisedBed: OperationTargetRaisedBed;
    mode?: OperationTargetScope;
    selectionType: 'multiple' | 'single';
    selectedValue?: string | null;
    onSelectedValueChange?: (value: string | null) => void;
};

export function RaisedBedTargetGroup({
    name,
    raisedBed,
    mode,
    selectionType,
    selectedValue,
    onSelectedValueChange,
}: RaisedBedTargetGroupProps) {
    const showFields = mode === undefined || mode === 'plant';
    const selectableRaisedBed = mode === undefined || mode === 'raisedBed';
    const selectableField = mode === undefined || mode === 'plant';
    const [fieldsOpen, setFieldsOpen] = useState(mode !== 'plant');
    const inputType = selectionType === 'single' ? 'radio' : 'checkbox';
    const raisedBedValue = `${raisedBed.accountId}|${
        raisedBed.gardenId ?? ''
    }|${raisedBed.id}`;
    const raisedBedIdentifier =
        raisedBed.physicalId ?? raisedBed.name ?? raisedBed.id.toString();
    const fieldsId = `raised-bed-${raisedBed.id}-fields`;
    const toggleLabel = fieldsOpen
        ? `Sakrij polja gredice ${raisedBedIdentifier}`
        : `Prikaži polja gredice ${raisedBedIdentifier}`;

    const raisedBedLabel = (
        <RaisedBedLabel
            physicalId={raisedBed.physicalId ?? null}
            name={raisedBed.name}
            size="compact"
        />
    );

    return (
        <div className="space-y-1">
            {selectableRaisedBed ? (
                <div className="flex items-center gap-1">
                    <label className="flex min-w-0 flex-1 items-center gap-2">
                        <input
                            type={inputType}
                            name={name}
                            value={raisedBedValue}
                            checked={
                                selectionType === 'single'
                                    ? selectedValue === raisedBedValue
                                    : undefined
                            }
                            onChange={(event) => {
                                if (selectionType === 'single') {
                                    onSelectedValueChange?.(
                                        event.target.checked
                                            ? event.target.value
                                            : null,
                                    );
                                }
                            }}
                        />
                        {raisedBedLabel}
                    </label>
                    {showFields ? (
                        <IconButton
                            type="button"
                            title={toggleLabel}
                            aria-expanded={fieldsOpen}
                            aria-controls={fieldsId}
                            onClick={() => setFieldsOpen((open) => !open)}
                        >
                            <ExpandDown
                                aria-hidden
                                className={`size-4 transition-transform ${
                                    fieldsOpen ? 'rotate-180' : ''
                                }`}
                            />
                        </IconButton>
                    ) : null}
                </div>
            ) : showFields ? (
                <Button
                    type="button"
                    variant="plain"
                    fullWidth
                    className="justify-between px-1"
                    aria-expanded={fieldsOpen}
                    aria-controls={fieldsId}
                    onClick={() => setFieldsOpen((open) => !open)}
                >
                    {raisedBedLabel}
                    <span className="sr-only">{toggleLabel}</span>
                    <ExpandDown
                        aria-hidden
                        className={`size-4 shrink-0 transition-transform ${
                            fieldsOpen ? 'rotate-180' : ''
                        }`}
                    />
                </Button>
            ) : (
                <div>{raisedBedLabel}</div>
            )}

            {showFields ? (
                <div
                    id={fieldsId}
                    className="ml-4 space-y-1"
                    hidden={!fieldsOpen}
                >
                    {raisedBed.fields.map((field) => {
                        const fieldValue = `${raisedBed.accountId}|${
                            raisedBed.gardenId ?? ''
                        }|${raisedBed.id}|${field.id}`;
                        const blocked =
                            isAdvancedSowingPlantOperationTargetBlocked({
                                application: mode,
                                hasActiveSelectedPlanting:
                                    field.hasActiveSelectedPlanting,
                            });

                        return (
                            <label
                                key={field.id}
                                className={`flex items-start gap-2 ${
                                    blocked ? 'text-muted-foreground' : ''
                                }`}
                            >
                                <input
                                    type={inputType}
                                    name={name}
                                    disabled={!selectableField || blocked}
                                    value={fieldValue}
                                    checked={
                                        selectionType === 'single'
                                            ? selectedValue === fieldValue
                                            : undefined
                                    }
                                    onChange={(event) => {
                                        if (selectionType === 'single') {
                                            onSelectedValueChange?.(
                                                event.target.checked
                                                    ? event.target.value
                                                    : null,
                                            );
                                        }
                                    }}
                                />
                                <span>
                                    {`Polje ${field.positionIndex + 1}`}
                                    {blocked ? (
                                        <>
                                            {' '}
                                            <span className="block text-xs">
                                                Napredna sjetva
                                            </span>
                                        </>
                                    ) : null}
                                </span>
                            </label>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}
