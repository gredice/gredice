'use client';

import { Button } from '@gredice/ui/Button';
import { cmsImageObjectPosition } from '@gredice/ui/cms';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Slider } from '@gredice/ui/Slider';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { type MouseEvent, useRef, useState } from 'react';
import {
    ImageUploadManager,
    type ImageUploadManagerHandle,
} from '../../../../components/shared/media/ImageUploadManager';

type CmsPageCoverImageFieldProps = {
    description?: string;
    disabled?: boolean;
    emptyLabel?: string;
    label?: string;
    modalTitle?: string;
    name: string;
    onChange: (value: string) => void;
    onPointOfInterestChange?: (x: number, y: number) => void;
    pageId?: number;
    pointOfInterestX?: number;
    pointOfInterestXName?: string;
    pointOfInterestY?: number;
    pointOfInterestYName?: string;
    usage?: 'cover' | 'seo';
    uploadEmptyLabel?: string;
    value: string;
};

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
    const match = fileName.toLowerCase().match(/\.[a-z0-9]{1,8}$/);
    return match?.[0] ?? '';
}

function getFileBaseName(fileName: string) {
    const extension = getFileExtension(fileName);
    const baseName = extension
        ? fileName.slice(0, Math.max(0, fileName.length - extension.length))
        : fileName;

    return toPathSegment(baseName).slice(0, 48) || 'cover';
}

function cmsCoverImageUploadPath({
    attempt,
    file,
    itemId,
    pageId,
    usage,
}: {
    attempt: number;
    file: File;
    itemId: string;
    pageId?: number;
    usage: 'cover' | 'seo';
}) {
    const pageSegment = pageId ? String(pageId) : 'draft';
    const extension = getFileExtension(file.name);
    const baseName = usage === 'seo' ? 'seo-image' : 'cover';
    const fileName = `${Date.now()}-${itemId}-${attempt}-${getFileBaseName(file.name) || baseName}${extension}`;

    return `cms/pages/${pageSegment}/${usage}/${fileName}`;
}

export function CmsPageCoverImageField({
    description = 'Koristi se kao cover za blog i changelog prikaze te kao slika unutar generirane društvene objave.',
    disabled,
    emptyLabel = 'Nema naslovne slike.',
    label = 'Naslovna slika',
    modalTitle = label,
    name,
    onChange,
    onPointOfInterestChange,
    pageId,
    pointOfInterestX = 50,
    pointOfInterestXName,
    pointOfInterestY = 50,
    pointOfInterestYName,
    usage = 'cover',
    uploadEmptyLabel = 'Odaberite jednu sliku.',
    value,
}: CmsPageCoverImageFieldProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const uploaderRef = useRef<ImageUploadManagerHandle>(null);
    const supportsPointOfInterest =
        usage === 'cover' && Boolean(onPointOfInterestChange);

    const handlePointOfInterestClick = (
        event: MouseEvent<HTMLButtonElement>,
    ) => {
        if (event.detail === 0) {
            return;
        }

        const bounds = event.currentTarget.getBoundingClientRect();
        const x = Math.min(
            100,
            Math.max(
                0,
                Math.round(
                    ((event.clientX - bounds.left) / bounds.width) * 100,
                ),
            ),
        );
        const y = Math.min(
            100,
            Math.max(
                0,
                Math.round(
                    ((event.clientY - bounds.top) / bounds.height) * 100,
                ),
            ),
        );
        onPointOfInterestChange?.(x, y);
    };

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
            setIsUploading(false);
            uploaderRef.current?.reset();
        }
    };

    const handleApplyImage = async () => {
        if (!uploaderRef.current?.hasImages()) {
            handleOpenChange(false);
            return;
        }

        setIsUploading(true);
        try {
            const uploadedUrls =
                await uploaderRef.current.uploadPendingImages();
            const uploadedUrl = uploadedUrls?.[0];
            if (!uploadedUrl) {
                return;
            }

            onChange(uploadedUrl);
            handleOpenChange(false);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Stack spacing={2}>
            <input name={name} type="hidden" value={value} readOnly />
            {pointOfInterestXName ? (
                <input
                    name={pointOfInterestXName}
                    type="hidden"
                    value={pointOfInterestX}
                    readOnly
                />
            ) : null}
            {pointOfInterestYName ? (
                <input
                    name={pointOfInterestYName}
                    type="hidden"
                    value={pointOfInterestY}
                    readOnly
                />
            ) : null}
            <div className="space-y-1">
                <Typography level="body3" semiBold>
                    {label}
                </Typography>
                <Typography level="body3" className="text-muted-foreground">
                    {description}
                </Typography>
            </div>
            {value ? (
                supportsPointOfInterest ? (
                    <Stack spacing={3}>
                        <div className="space-y-1">
                            <Typography level="body3" semiBold>
                                Točka interesa
                            </Typography>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Kliknite najvažniju točku na cijeloj slici. Ona
                                ostaje u središtu kad se slika izrezuje u
                                različite omjere.
                            </Typography>
                        </div>
                        <div className="flex max-h-80 justify-center overflow-hidden rounded-md border bg-muted">
                            <div className="relative inline-flex max-w-full">
                                {/** biome-ignore lint/performance/noImgElement: Admin preview supports arbitrary uploaded image URLs. */}
                                <img
                                    alt="Naslovna slika stranice"
                                    className="block max-h-80 max-w-full object-contain"
                                    src={value}
                                />
                                <button
                                    aria-label="Odaberi točku interesa na naslovnoj slici"
                                    className="absolute inset-0 cursor-crosshair focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                                    onClick={handlePointOfInterestClick}
                                    type="button"
                                >
                                    <span
                                        aria-hidden
                                        className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary/80 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
                                        style={{
                                            left: `${pointOfInterestX}%`,
                                            top: `${pointOfInterestY}%`,
                                        }}
                                    />
                                </button>
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Slider
                                aria-label="Vodoravna pozicija točke interesa"
                                label={`Vodoravno: ${pointOfInterestX}%`}
                                max={100}
                                min={0}
                                onValueChange={([x]) =>
                                    onPointOfInterestChange?.(
                                        x ?? pointOfInterestX,
                                        pointOfInterestY,
                                    )
                                }
                                step={1}
                                value={[pointOfInterestX]}
                            />
                            <Slider
                                aria-label="Okomita pozicija točke interesa"
                                label={`Okomito: ${pointOfInterestY}%`}
                                max={100}
                                min={0}
                                onValueChange={([y]) =>
                                    onPointOfInterestChange?.(
                                        pointOfInterestX,
                                        y ?? pointOfInterestY,
                                    )
                                }
                                step={1}
                                value={[pointOfInterestY]}
                            />
                        </div>
                        <div className="space-y-1">
                            <Typography level="body3" semiBold>
                                Pregled izreza 16:9
                            </Typography>
                            <div className="overflow-hidden rounded-md border bg-muted">
                                {/** biome-ignore lint/performance/noImgElement: Admin preview supports arbitrary uploaded image URLs. */}
                                <img
                                    alt="Pregled izreza naslovne slike"
                                    className="aspect-video w-full object-cover"
                                    src={value}
                                    style={{
                                        objectPosition: cmsImageObjectPosition(
                                            pointOfInterestX,
                                            pointOfInterestY,
                                        ),
                                    }}
                                />
                            </div>
                        </div>
                    </Stack>
                ) : (
                    <div className="overflow-hidden rounded-md border bg-muted">
                        {/** biome-ignore lint/performance/noImgElement: Admin preview supports arbitrary uploaded image URLs. */}
                        <img
                            alt="Naslovna slika stranice"
                            className="aspect-video w-full object-cover"
                            src={value}
                        />
                    </div>
                )
            ) : (
                <div className="flex aspect-video items-center justify-center rounded-md border border-dashed bg-muted/30 px-4 text-center">
                    <Typography level="body2" className="text-muted-foreground">
                        {emptyLabel}
                    </Typography>
                </div>
            )}
            {value && (
                <Typography
                    level="body3"
                    className="truncate text-muted-foreground"
                >
                    {value}
                </Typography>
            )}
            <Row spacing={2} className="flex-wrap">
                <Modal
                    title={modalTitle}
                    open={isOpen}
                    onOpenChange={handleOpenChange}
                    className="max-w-xl"
                    trigger={
                        <Button
                            type="button"
                            variant="outlined"
                            disabled={disabled}
                        >
                            {value ? 'Zamijeni sliku' : 'Dodaj sliku'}
                        </Button>
                    }
                >
                    <Stack spacing={4}>
                        <div className="space-y-1 pr-8">
                            <Typography level="h3">{modalTitle}</Typography>
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Odaberite datoteku, uslikajte fotografiju ili
                                zalijepite sliku iz međuspremnika.
                            </Typography>
                        </div>
                        <ImageUploadManager
                            ref={uploaderRef}
                            multiple={false}
                            maxItems={1}
                            disabled={isUploading}
                            addLabel="Odaberi sliku"
                            addMoreLabel="Zamijeni odabranu sliku"
                            emptyLabel={uploadEmptyLabel}
                            handleUploadUrl="/api/cms/images/upload"
                            clientPayload={JSON.stringify({
                                pageId: pageId ?? null,
                                usage,
                            })}
                            selectedLabel={() => 'Odabrana je jedna slika.'}
                            uploadPath={({ attempt, file, itemId }) =>
                                cmsCoverImageUploadPath({
                                    attempt,
                                    file,
                                    itemId,
                                    pageId,
                                    usage,
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
                                onClick={handleApplyImage}
                            >
                                Primijeni sliku
                            </Button>
                        </Row>
                    </Stack>
                </Modal>
                {value && (
                    <Button
                        type="button"
                        variant="plain"
                        color="danger"
                        disabled={disabled}
                        onClick={() => onChange('')}
                    >
                        Ukloni
                    </Button>
                )}
            </Row>
        </Stack>
    );
}
