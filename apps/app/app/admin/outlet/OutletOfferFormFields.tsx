'use client';

import { Input } from '@gredice/ui/Input';
import { SelectItems } from '@gredice/ui/SelectItems';
import { useEffect, useMemo, useState } from 'react';
import { formatPrice } from './format';
import {
    formatEndAtOffset,
    type OutletOfferFormInitialValues,
    type OutletOfferPlantSortItem,
} from './outletOfferFormValues';

type OutletOfferFormFieldsProps = {
    initialValues: OutletOfferFormInitialValues;
    plantSortItems: OutletOfferPlantSortItem[];
};

const initialPlantStatusOptions = [
    { value: 'sowed', label: 'Posijano' },
    { value: 'sprouted', label: 'Proklijalo' },
    { value: 'ready', label: 'Spremno za presađivanje' },
];

const offerStatusOptions = [
    { value: 'draft', label: 'Skica' },
    { value: 'published', label: 'Objavljeno' },
    { value: 'paused', label: 'Pauzirano' },
    { value: 'closed', label: 'Zatvoreno' },
];

export function OutletOfferFormFields({
    initialValues,
    plantSortItems,
}: OutletOfferFormFieldsProps) {
    const comparePriceByPlantSortId = useMemo(
        () =>
            new Map(
                plantSortItems.map((plantSort) => [
                    plantSort.value,
                    plantSort.comparePriceValue,
                ]),
            ),
        [plantSortItems],
    );
    const initialAutoComparePrice = initialValues.plantSortId
        ? (comparePriceByPlantSortId.get(initialValues.plantSortId) ?? '')
        : '';
    const [selectedPlantSortId, setSelectedPlantSortId] = useState(
        initialValues.plantSortId ?? '',
    );
    const [comparePrice, setComparePrice] = useState(
        initialValues.comparePrice,
    );
    const [lastAutoComparePrice, setLastAutoComparePrice] = useState(
        initialAutoComparePrice,
    );
    const [endAt, setEndAt] = useState(initialValues.endAt);
    const [now, setNow] = useState(() => new Date());
    const selectedSortComparePrice =
        comparePriceByPlantSortId.get(selectedPlantSortId) ?? '';
    const comparePriceHelperText =
        selectedSortComparePrice && comparePrice === selectedSortComparePrice
            ? 'Preuzeto iz odabrane sorte.'
            : initialValues.comparePriceCents
              ? `Trenutno ${formatPrice(initialValues.comparePriceCents)}`
              : 'Opcionalno za prikaz popusta.';

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setNow(new Date());
        }, 60 * 1000);

        return () => window.clearInterval(intervalId);
    }, []);

    const handlePlantSortChange = (nextPlantSortId: string) => {
        const nextAutoComparePrice =
            comparePriceByPlantSortId.get(nextPlantSortId) ?? '';

        setSelectedPlantSortId(nextPlantSortId);
        setComparePrice((currentComparePrice) => {
            const shouldUseSortPrice =
                currentComparePrice.trim() === '' ||
                currentComparePrice.trim() === lastAutoComparePrice;

            return shouldUseSortPrice
                ? nextAutoComparePrice
                : currentComparePrice;
        });
        setLastAutoComparePrice(nextAutoComparePrice);
    };

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <SelectItems
                name="plantSortId"
                label="Sorta"
                placeholder="Odaberite sortu"
                items={plantSortItems}
                defaultValue={initialValues.plantSortId}
                onValueChange={handlePlantSortChange}
                searchable
                required
            />
            <SelectItems
                name="status"
                label="Status ponude"
                items={offerStatusOptions}
                defaultValue={initialValues.status}
                required
            />
            <Input
                name="outletPrice"
                label="Outlet cijena"
                type="number"
                min="0"
                step="0.01"
                defaultValue={initialValues.outletPrice}
                endDecorator={
                    <span className="px-3 text-sm text-muted-foreground">
                        EUR
                    </span>
                }
                required
                fullWidth
            />
            <Input
                name="comparePrice"
                label="Usporedna cijena"
                type="number"
                min="0"
                step="0.01"
                value={comparePrice}
                onChange={(event) => setComparePrice(event.target.value)}
                helperText={comparePriceHelperText}
                endDecorator={
                    <span className="px-3 text-sm text-muted-foreground">
                        EUR
                    </span>
                }
                fullWidth
            />
            <Input
                name="quantity"
                label="Ukupna količina"
                type="number"
                min="1"
                step="1"
                defaultValue={initialValues.quantity}
                required
                fullWidth
            />
            <SelectItems
                name="initialPlantStatus"
                label="Početni status sadnice"
                items={initialPlantStatusOptions}
                defaultValue={initialValues.initialPlantStatus}
                required
            />
            <Input
                name="sowingDate"
                label="Datum sjetve"
                type="date"
                defaultValue={initialValues.sowingDate}
                required
                fullWidth
            />
            <Input
                name="startAt"
                label="Početak ponude"
                type="datetime-local"
                defaultValue={initialValues.startAt}
                required
                fullWidth
            />
            <Input
                name="endAt"
                label="Kraj ponude"
                type="datetime-local"
                value={endAt}
                onChange={(event) => setEndAt(event.target.value)}
                helperText={formatEndAtOffset(endAt, now)}
                required
                fullWidth
            />
        </div>
    );
}
