'use server';

import {
    createOutletOffer,
    getOutletOffer,
    type OutletOfferStatus,
    updateOutletOffer,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';

const outletOfferStatuses: OutletOfferStatus[] = [
    'draft',
    'published',
    'paused',
    'closed',
];

function formText(formData: FormData, key: string) {
    const value = formData.get(key);
    return typeof value === 'string' ? value.trim() : '';
}

function parsePositiveInteger(formData: FormData, key: string, label: string) {
    const value = Number.parseInt(formText(formData, key), 10);
    if (!Number.isFinite(value) || value < 1) {
        throw new Error(`${label} mora biti veći od nule.`);
    }

    return value;
}

function parsePriceCents(formData: FormData, key: string, label: string) {
    const rawValue = formText(formData, key).replace(',', '.');
    const value = Number.parseFloat(rawValue);
    if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${label} mora biti valjan iznos.`);
    }

    return Math.round(value * 100);
}

function parseOptionalPriceCents(
    formData: FormData,
    key: string,
    label: string,
) {
    const rawValue = formText(formData, key);
    if (!rawValue) {
        return null;
    }

    return parsePriceCents(formData, key, label);
}

function parseDateTime(formData: FormData, key: string, label: string) {
    const rawValue = formText(formData, key);
    const date = new Date(rawValue);
    if (!rawValue || Number.isNaN(date.getTime())) {
        throw new Error(`${label} mora biti valjan datum.`);
    }

    return date;
}

function isOutletOfferStatus(status: string): status is OutletOfferStatus {
    return outletOfferStatuses.some((knownStatus) => knownStatus === status);
}

function parseSowingDate(formData: FormData) {
    const rawValue = formText(formData, 'sowingDate');
    const date = new Date(`${rawValue}T12:00:00`);
    if (!rawValue || Number.isNaN(date.getTime())) {
        throw new Error('Datum sjetve mora biti valjan.');
    }

    return date;
}

function parseOutletOfferStatus(formData: FormData) {
    const status = formText(formData, 'status');
    return isOutletOfferStatus(status) ? status : 'draft';
}

function parseImageUrls(formData: FormData) {
    return formText(formData, 'imageUrls')
        .split(/[\n,]/u)
        .map((url) => url.trim())
        .filter((url) => url.length > 0);
}

function parseOutletOfferInput(formData: FormData) {
    const startAt = parseDateTime(formData, 'startAt', 'Početak ponude');
    const endAt = parseDateTime(formData, 'endAt', 'Kraj ponude');
    if (endAt.getTime() <= startAt.getTime()) {
        throw new Error('Kraj ponude mora biti nakon početka.');
    }

    return {
        plantSortId: parsePositiveInteger(formData, 'plantSortId', 'Sorta'),
        sowingDate: parseSowingDate(formData),
        initialPlantStatus:
            formText(formData, 'initialPlantStatus') || 'sprouted',
        imageUrls: parseImageUrls(formData),
        outletPriceCents: parsePriceCents(
            formData,
            'outletPrice',
            'Outlet cijena',
        ),
        comparePriceCents: parseOptionalPriceCents(
            formData,
            'comparePrice',
            'Usporedna cijena',
        ),
        quantity: parsePositiveInteger(formData, 'quantity', 'Količina'),
        startAt,
        endAt,
        status: parseOutletOfferStatus(formData),
        adminNotes: formText(formData, 'adminNotes') || null,
    };
}

function revalidateOutletAdminPaths(offerId?: number) {
    revalidatePath(KnownPages.Outlet);
    revalidatePath('/outlet');
    if (offerId) {
        revalidatePath(KnownPages.OutletOffer(offerId));
        revalidatePath(KnownPages.OutletOfferEdit(offerId));
    }
}

export async function createOutletOfferAction(formData: FormData) {
    await auth(['admin']);

    const offerId = await createOutletOffer(parseOutletOfferInput(formData));
    revalidateOutletAdminPaths(offerId);
    redirect(KnownPages.OutletOffer(offerId));
}

export async function updateOutletOfferAction(
    offerId: number,
    formData: FormData,
) {
    await auth(['admin']);

    const payload = parseOutletOfferInput(formData);
    const existingOffer = await getOutletOffer(offerId);
    if (!existingOffer) {
        throw new Error('Outlet ponuda ne postoji.');
    }

    const committedQuantity =
        existingOffer.reservedQuantity + existingOffer.soldQuantity;
    if (payload.quantity < committedQuantity) {
        throw new Error(
            `Količina ne može biti manja od ${committedQuantity} jer toliko sadnica već ima aktivnu rezervaciju ili prodaju.`,
        );
    }

    await updateOutletOffer(offerId, payload);
    revalidateOutletAdminPaths(offerId);
    redirect(KnownPages.OutletOffer(offerId));
}

export async function updateOutletOfferStatusAction(
    offerId: number,
    status: OutletOfferStatus,
) {
    await auth(['admin']);

    await updateOutletOffer(offerId, { status });
    revalidateOutletAdminPaths(offerId);
}

export async function duplicateOutletOfferAction(offerId: number) {
    await auth(['admin']);

    const offer = await getOutletOffer(offerId);
    if (!offer) {
        throw new Error('Outlet ponuda ne postoji.');
    }

    const duplicatedOfferId = await createOutletOffer({
        plantSortId: offer.plantSortId,
        sowingDate: offer.sowingDate,
        initialPlantStatus: offer.initialPlantStatus,
        imageUrls: offer.imageUrls,
        outletPriceCents: offer.outletPriceCents,
        comparePriceCents: offer.comparePriceCents,
        quantity: offer.quantity,
        startAt: offer.startAt,
        endAt: offer.endAt,
        status: 'draft',
        adminNotes: offer.adminNotes,
    });

    revalidateOutletAdminPaths(duplicatedOfferId);
    redirect(KnownPages.OutletOfferEdit(duplicatedOfferId));
}
