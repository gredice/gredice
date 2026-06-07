import type { OutletOfferWithAvailability } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Card } from '@gredice/ui/Card';
import { Input } from '@gredice/ui/Input';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import { KnownPages } from '../../../src/KnownPages';
import {
    formatDateInputValue,
    formatDateTimeInputValue,
    formatPrice,
} from './format';

type OutletOfferFormProps = {
    action: (formData: FormData) => void | Promise<void>;
    offer?: OutletOfferWithAvailability;
    plantSorts: EntityStandardized[];
    submitLabel: string;
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

function plantSortLabel(plantSort: EntityStandardized) {
    return (
        plantSort.information?.label ??
        plantSort.information?.name ??
        `Sorta ${plantSort.id}`
    );
}

function priceInputValue(cents: number | null | undefined) {
    if (typeof cents !== 'number') {
        return '';
    }

    return (cents / 100).toFixed(2);
}

function defaultStartAt() {
    return formatDateTimeInputValue(new Date());
}

function defaultEndAt() {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return formatDateTimeInputValue(date);
}

export function OutletOfferForm({
    action,
    offer,
    plantSorts,
    submitLabel,
}: OutletOfferFormProps) {
    const plantSortItems = plantSorts.map((plantSort) => ({
        value: plantSort.id.toString(),
        label: plantSortLabel(plantSort),
    }));

    return (
        <Card className="max-w-4xl">
            <form action={action}>
                <Stack spacing={8} className="p-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <SelectItems
                            name="plantSortId"
                            label="Sorta"
                            placeholder="Odaberite sortu"
                            items={plantSortItems}
                            defaultValue={offer?.plantSortId.toString()}
                            searchable
                            required
                        />
                        <SelectItems
                            name="status"
                            label="Status ponude"
                            items={offerStatusOptions}
                            defaultValue={offer?.status ?? 'draft'}
                            required
                        />
                        <Input
                            name="outletPrice"
                            label="Outlet cijena"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={priceInputValue(
                                offer?.outletPriceCents,
                            )}
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
                            defaultValue={priceInputValue(
                                offer?.comparePriceCents,
                            )}
                            helperText={
                                offer?.comparePriceCents
                                    ? `Trenutno ${formatPrice(
                                          offer.comparePriceCents,
                                      )}`
                                    : 'Opcionalno za prikaz popusta.'
                            }
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
                            defaultValue={offer?.quantity ?? 1}
                            required
                            fullWidth
                        />
                        <SelectItems
                            name="initialPlantStatus"
                            label="Početni status sadnice"
                            items={initialPlantStatusOptions}
                            defaultValue={
                                offer?.initialPlantStatus ?? 'sprouted'
                            }
                            required
                        />
                        <Input
                            name="sowingDate"
                            label="Datum sjetve"
                            type="date"
                            defaultValue={
                                offer
                                    ? formatDateInputValue(offer.sowingDate)
                                    : formatDateInputValue(new Date())
                            }
                            required
                            fullWidth
                        />
                        <Input
                            name="startAt"
                            label="Početak ponude"
                            type="datetime-local"
                            defaultValue={
                                offer
                                    ? formatDateTimeInputValue(offer.startAt)
                                    : defaultStartAt()
                            }
                            required
                            fullWidth
                        />
                        <Input
                            name="endAt"
                            label="Kraj ponude"
                            type="datetime-local"
                            defaultValue={
                                offer
                                    ? formatDateTimeInputValue(offer.endAt)
                                    : defaultEndAt()
                            }
                            required
                            fullWidth
                        />
                    </div>

                    <Stack spacing={2}>
                        <label
                            className="text-sm font-medium"
                            htmlFor="outlet-image-urls"
                        >
                            Slike
                        </label>
                        <textarea
                            className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            defaultValue={offer?.imageUrls.join('\n') ?? ''}
                            id="outlet-image-urls"
                            name="imageUrls"
                            placeholder="https://..."
                        />
                        <p className="text-xs text-muted-foreground">
                            Jedan URL po retku ili odvojeno zarezom. Prva slika
                            se koristi kao naslovna.
                        </p>
                    </Stack>

                    <Stack spacing={2}>
                        <label
                            className="text-sm font-medium"
                            htmlFor="outlet-admin-notes"
                        >
                            Interne napomene
                        </label>
                        <textarea
                            className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            defaultValue={offer?.adminNotes ?? ''}
                            id="outlet-admin-notes"
                            name="adminNotes"
                        />
                    </Stack>

                    <div className="flex flex-wrap items-center gap-3">
                        <Button type="submit">{submitLabel}</Button>
                        <Button
                            href={
                                offer
                                    ? KnownPages.OutletOffer(offer.id)
                                    : KnownPages.Outlet
                            }
                            variant="outlined"
                            color="neutral"
                        >
                            Odustani
                        </Button>
                    </div>
                </Stack>
            </form>
        </Card>
    );
}
