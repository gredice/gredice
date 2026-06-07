'use client';

import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Clear } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useMemo, useRef, useState } from 'react';
import {
    ImageUploadManager,
    type ImageUploadManagerHandle,
} from '../../../components/shared/media/ImageUploadManager';

type OutletOfferImagesFieldProps = {
    offerId?: number;
    initialImageUrls?: string[];
    name: string;
};

function parseImageUrlText(value: string) {
    return value
        .split(/[\n,]/u)
        .map((url) => url.trim())
        .filter((url) => url.length > 0);
}

function uniqueImageUrls(imageUrls: string[]) {
    return imageUrls.filter(
        (imageUrl, index) => imageUrls.indexOf(imageUrl) === index,
    );
}

function imageUrlText(imageUrls: string[]) {
    return uniqueImageUrls(imageUrls).join('\n');
}

function toPathSegment(value: string) {
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);

    return normalized || 'image';
}

function getFileExtension(fileName: string) {
    const match = fileName.toLowerCase().match(/\.[a-z0-9]{1,8}$/u);
    return match?.[0] ?? '';
}

function getFileBaseName(fileName: string) {
    const extension = getFileExtension(fileName);
    const baseName = extension
        ? fileName.slice(0, Math.max(0, fileName.length - extension.length))
        : fileName;

    return toPathSegment(baseName).slice(0, 48) || 'outlet-image';
}

function outletImageUploadPath({
    attempt,
    file,
    itemId,
    offerId,
}: {
    attempt: number;
    file: File;
    itemId: string;
    offerId?: number;
}) {
    const offerSegment = offerId ? String(offerId) : 'draft';
    const extension = getFileExtension(file.name);
    const fileName = `${Date.now()}-${itemId}-${attempt}-${getFileBaseName(file.name)}${extension}`;

    return `outlet/offers/${offerSegment}/images/${fileName}`;
}

export function OutletOfferImagesField({
    offerId,
    initialImageUrls = [],
    name,
}: OutletOfferImagesFieldProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [imageUrlsValue, setImageUrlsValue] = useState(() =>
        imageUrlText(initialImageUrls),
    );
    const uploaderRef = useRef<ImageUploadManagerHandle>(null);
    const imageUrls = useMemo(
        () => uniqueImageUrls(parseImageUrlText(imageUrlsValue)),
        [imageUrlsValue],
    );

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
            setIsUploading(false);
            uploaderRef.current?.reset();
        }
    };

    const handleApplyImages = async () => {
        if (!uploaderRef.current?.hasImages()) {
            handleOpenChange(false);
            return;
        }

        setIsUploading(true);
        try {
            const uploadedUrls =
                await uploaderRef.current.uploadPendingImages();
            if (!uploadedUrls) {
                return;
            }

            setImageUrlsValue((currentValue) =>
                imageUrlText([
                    ...parseImageUrlText(currentValue),
                    ...uploadedUrls,
                ]),
            );
            handleOpenChange(false);
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveImage = (imageUrl: string) => {
        setImageUrlsValue((currentValue) =>
            imageUrlText(
                parseImageUrlText(currentValue).filter(
                    (currentImageUrl) => currentImageUrl !== imageUrl,
                ),
            ),
        );
    };

    return (
        <Stack spacing={3}>
            <div className="space-y-1">
                <label
                    className="text-sm font-medium"
                    htmlFor="outlet-image-urls"
                >
                    Slike
                </label>
                <Typography level="body3" className="text-muted-foreground">
                    Prva slika se koristi kao naslovna. URL-ove možete ručno
                    urediti ili dodati slike iz uređaja, kamere ili
                    međuspremnika.
                </Typography>
            </div>

            {imageUrls.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {imageUrls.map((imageUrl, index) => (
                        <div
                            className="overflow-hidden rounded-md border bg-background"
                            key={imageUrl}
                        >
                            <div className="relative aspect-video bg-muted">
                                {/** biome-ignore lint/performance/noImgElement: Admin preview supports arbitrary uploaded image URLs. */}
                                <img
                                    alt={`Slika outlet ponude ${index + 1}`}
                                    className="h-full w-full object-cover"
                                    src={imageUrl}
                                />
                                <IconButton
                                    aria-label="Ukloni sliku"
                                    className="absolute right-2 top-2 bg-background/90"
                                    size="xs"
                                    type="button"
                                    variant="outlined"
                                    onClick={() => handleRemoveImage(imageUrl)}
                                >
                                    <Clear className="size-3.5" />
                                </IconButton>
                            </div>
                            <Typography
                                level="body3"
                                className="truncate px-3 py-2 text-muted-foreground"
                            >
                                {imageUrl}
                            </Typography>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex aspect-video items-center justify-center rounded-md border border-dashed bg-muted/30 px-4 text-center">
                    <Typography level="body2" className="text-muted-foreground">
                        Nema dodanih slika.
                    </Typography>
                </div>
            )}

            <Row spacing={2} className="flex-wrap">
                <Modal
                    title="Dodaj slike outlet ponude"
                    open={isOpen}
                    onOpenChange={handleOpenChange}
                    className="max-w-xl"
                    trigger={
                        <Button type="button" variant="outlined">
                            Dodaj slike
                        </Button>
                    }
                >
                    <Stack spacing={4}>
                        <div className="space-y-1 pr-8">
                            <Typography level="h3">
                                Dodaj slike outlet ponude
                            </Typography>
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Odaberite datoteke, uslikajte fotografiju ili
                                zalijepite sliku iz međuspremnika.
                            </Typography>
                        </div>
                        <ImageUploadManager
                            ref={uploaderRef}
                            disabled={isUploading}
                            addLabel="Odaberi slike"
                            addMoreLabel="Dodaj još slika"
                            emptyLabel="Odaberite slike ili ih zalijepite iz međuspremnika."
                            handleUploadUrl="/api/outlet/images/upload"
                            clientPayload={JSON.stringify({
                                offerId: offerId ?? null,
                            })}
                            pasteHint="Kliknite u ovo područje i zalijepite sliku iz međuspremnika."
                            uploadPath={({ attempt, file, itemId }) =>
                                outletImageUploadPath({
                                    attempt,
                                    file,
                                    itemId,
                                    offerId,
                                })
                            }
                        />
                        <Row spacing={2} justifyContent="end">
                            <Button
                                type="button"
                                variant="outlined"
                                disabled={isUploading}
                                onClick={() => handleOpenChange(false)}
                            >
                                Odustani
                            </Button>
                            <Button
                                type="button"
                                variant="solid"
                                disabled={isUploading}
                                loading={isUploading}
                                onClick={handleApplyImages}
                            >
                                Dodaj slike
                            </Button>
                        </Row>
                    </Stack>
                </Modal>
                {imageUrls.length > 0 && (
                    <Button
                        type="button"
                        variant="plain"
                        color="danger"
                        onClick={() => setImageUrlsValue('')}
                    >
                        Ukloni sve
                    </Button>
                )}
            </Row>

            <textarea
                className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
                id="outlet-image-urls"
                name={name}
                onChange={(event) => setImageUrlsValue(event.target.value)}
                placeholder="https://..."
                value={imageUrlsValue}
            />
            <Typography level="body3" className="text-muted-foreground">
                Jedan URL po retku ili odvojeno zarezom.
            </Typography>
        </Stack>
    );
}
