import type { OutletOfferWithAvailability } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Card } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import { KnownPages } from '../../../src/KnownPages';
import { formatDateInputValue, formatDateTimeInputValue } from './format';
import { OutletOfferFormFields } from './OutletOfferFormFields';
import { OutletOfferImagesField } from './OutletOfferImagesField';
import {
    outletPlantSortFormItems,
    priceInputValue,
} from './outletOfferFormValues';

type OutletOfferFormProps = {
    action: (formData: FormData) => void | Promise<void>;
    offer?: OutletOfferWithAvailability;
    plantSorts: EntityStandardized[];
    submitLabel: string;
};

function defaultEndAt(now: Date) {
    const date = new Date(now);
    date.setDate(date.getDate() + 7);
    return formatDateTimeInputValue(date);
}

export function OutletOfferForm({
    action,
    offer,
    plantSorts,
    submitLabel,
}: OutletOfferFormProps) {
    const now = new Date();
    const plantSortItems = outletPlantSortFormItems(plantSorts);
    const initialValues = {
        plantSortId: offer?.plantSortId.toString(),
        status: offer?.status ?? 'draft',
        outletPrice: priceInputValue(offer?.outletPriceCents),
        comparePrice: priceInputValue(offer?.comparePriceCents),
        comparePriceCents: offer?.comparePriceCents ?? null,
        quantity: offer?.quantity ?? 1,
        initialPlantStatus: offer?.initialPlantStatus ?? 'sprouted',
        sowingDate: offer
            ? formatDateInputValue(offer.sowingDate)
            : formatDateInputValue(now),
        startAt: offer
            ? formatDateTimeInputValue(offer.startAt)
            : formatDateTimeInputValue(now),
        endAt: offer
            ? formatDateTimeInputValue(offer.endAt)
            : defaultEndAt(now),
    };

    return (
        <Card className="max-w-4xl">
            <form action={action}>
                <Stack spacing={8} className="p-6">
                    <OutletOfferFormFields
                        initialValues={initialValues}
                        plantSortItems={plantSortItems}
                    />

                    <OutletOfferImagesField
                        offerId={offer?.id}
                        initialImageUrls={offer?.imageUrls}
                        name="imageUrls"
                    />

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
