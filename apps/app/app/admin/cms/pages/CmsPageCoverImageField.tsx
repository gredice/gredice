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
    disabled?: boolean;
    name: string;
    onChange: (value: string) => void;
    pageId?: number;
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
}: {
    attempt: number;
    file: File;
    itemId: string;
    pageId?: number;
}) {
    const pageSegment = pageId ? String(pageId) : 'draft';
    const extension = getFileExtension(file.name);
    const fileName = `${Date.now()}-${itemId}-${attempt}-${getFileBaseName(file.name)}${extension}`;

    return `cms/pages/${pageSegment}/cover/${fileName}`;
}

export function CmsPageCoverImageField({
    disabled,
    name,
    onChange,
    pageId,
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
                    Naslovna slika
                </Typography>
                <Typography level="body3" className="text-muted-foreground">
                    Koristi se kao cover za blog i changelog prikaze te kao
                    društvena slika za standardne stranice.
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
                        Nema naslovne slike.
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
                    title="Naslovna slika"
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
                            <Typography level="h3">Naslovna slika</Typography>
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
                            emptyLabel="Odaberite jednu sliku za naslovnicu."
                            handleUploadUrl="/api/cms/images/upload"
                            clientPayload={JSON.stringify({
                                pageId: pageId ?? null,
                                usage: 'cover',
                            })}
                            selectedLabel={() => 'Odabrana je jedna slika.'}
                            uploadPath={({ attempt, file, itemId }) =>
                                cmsCoverImageUploadPath({
                                    attempt,
                                    file,
                                    itemId,
                                    pageId,
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
