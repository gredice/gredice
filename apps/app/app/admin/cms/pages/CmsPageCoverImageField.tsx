'use client';

import { Button } from '@gredice/ui/Button';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useRef, useState } from 'react';
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
    pageId?: number;
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
    pageId,
    usage = 'cover',
    uploadEmptyLabel = 'Odaberite jednu sliku.',
    value,
}: CmsPageCoverImageFieldProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const uploaderRef = useRef<ImageUploadManagerHandle>(null);

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
            <div className="space-y-1">
                <Typography level="body3" semiBold>
                    {label}
                </Typography>
                <Typography level="body3" className="text-muted-foreground">
                    {description}
                </Typography>
            </div>
            {value ? (
                <div className="overflow-hidden rounded-md border bg-muted">
                    {/** biome-ignore lint/performance/noImgElement: Admin preview supports arbitrary uploaded image URLs. */}
                    <img
                        alt="Naslovna slika stranice"
                        className="aspect-video w-full object-cover"
                        src={value}
                    />
                </div>
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
