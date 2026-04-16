'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { upload } from '@vercel/blob/client';
import { useRef, useState } from 'react';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import {
    completeOperation,
    completeOperationWithImageUrls,
} from '../../(actions)/operationActions';

type UploadItemStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

type UploadItem = {
    id: string;
    file: File;
    progress: number;
    status: UploadItemStatus;
    uploadedUrl?: string;
    errorMessage?: string;
    attempts: number;
};

const MAX_UPLOAD_ATTEMPTS = 3;
const MULTIPART_UPLOAD_THRESHOLD_BYTES = 5 * 1024 * 1024;

function createUploadItem(file: File): UploadItem {
    return {
        id: crypto.randomUUID(),
        file,
        progress: 0,
        status: 'pending',
        attempts: 0,
    };
}

function clampUploadProgress(progress: number) {
    return Math.max(0, Math.min(100, Math.round(progress)));
}

function getUploadItemStatusLabel(uploadItem: UploadItem) {
    switch (uploadItem.status) {
        case 'uploaded':
            return 'Učitano';
        case 'uploading':
            return uploadItem.attempts > 1
                ? `Učitavanje, pokušaj ${uploadItem.attempts}/${MAX_UPLOAD_ATTEMPTS}`
                : 'Učitavanje';
        case 'failed':
            return uploadItem.errorMessage
                ? `Neuspjelo: ${uploadItem.errorMessage}`
                : `Neuspjelo nakon ${uploadItem.attempts}/${MAX_UPLOAD_ATTEMPTS} pokušaja`;
        default:
            return 'Čeka učitavanje';
    }
}

function getUploadItemStatusClassName(uploadItem: UploadItem) {
    switch (uploadItem.status) {
        case 'uploaded':
            return 'text-green-600';
        case 'failed':
            return 'text-red-600';
        default:
            return 'text-muted-foreground';
    }
}

function getUploadItemProgressClassName(uploadItem: UploadItem) {
    switch (uploadItem.status) {
        case 'uploaded':
            return 'bg-green-600';
        case 'failed':
            return 'bg-red-600';
        case 'uploading':
            return 'bg-primary';
        default:
            return 'bg-muted-foreground/40';
    }
}

type CompleteOperationModalProps = {
    operationId: number;
    label: string;
    conditions?: EntityStandardized['conditions'];
};

export function CompleteOperationModal({
    operationId,
    label,
    conditions,
}: CompleteOperationModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const attachImages = conditions?.completionAttachImages;
    const attachRequired = conditions?.completionAttachImagesRequired;
    const hasFailedUploads = uploadItems.some(
        (uploadItem) => uploadItem.status === 'failed',
    );

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        setErrorMessage(null);
        if (!open) {
            setUploadItems([]);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const nextUploadItems = Array.from(e.target.files).map(
                createUploadItem,
            );
            setUploadItems((currentUploadItems) => [
                ...currentUploadItems,
                ...nextUploadItems,
            ]);
            setErrorMessage(null);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const updateUploadItem = (
        uploadItemId: string,
        updater: (uploadItem: UploadItem) => UploadItem,
    ) => {
        setUploadItems((currentUploadItems) =>
            currentUploadItems.map((uploadItem) =>
                uploadItem.id === uploadItemId
                    ? updater(uploadItem)
                    : uploadItem,
            ),
        );
    };

    const resetUploadItem = (uploadItemId: string) => {
        setErrorMessage(null);
        updateUploadItem(uploadItemId, (uploadItem) => ({
            ...uploadItem,
            progress: 0,
            status: 'pending',
            errorMessage: undefined,
            attempts: 0,
        }));
    };

    const uploadImage = async (uploadItem: UploadItem) => {
        const extension = uploadItem.file.name.includes('.')
            ? uploadItem.file.name.slice(uploadItem.file.name.lastIndexOf('.'))
            : '';
        let lastErrorMessage = 'Spremanje slike nije uspjelo.';

        for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt++) {
            const pathname = `operations/${operationId}/${uploadItem.id}-${attempt}${extension}`;

            updateUploadItem(uploadItem.id, (currentUploadItem) => ({
                ...currentUploadItem,
                progress: 0,
                status: 'uploading',
                errorMessage: undefined,
                attempts: attempt,
            }));

            try {
                const uploadedImage = await upload(pathname, uploadItem.file, {
                    access: 'public',
                    contentType: uploadItem.file.type || undefined,
                    handleUploadUrl: '/api/operations/images/upload',
                    clientPayload: JSON.stringify({ operationId }),
                    multipart:
                        uploadItem.file.size > MULTIPART_UPLOAD_THRESHOLD_BYTES,
                    onUploadProgress: ({ percentage }) => {
                        updateUploadItem(
                            uploadItem.id,
                            (currentUploadItem) => ({
                                ...currentUploadItem,
                                progress: clampUploadProgress(percentage),
                                status: 'uploading',
                                attempts: attempt,
                            }),
                        );
                    },
                });

                updateUploadItem(uploadItem.id, (currentUploadItem) => ({
                    ...currentUploadItem,
                    progress: 100,
                    status: 'uploaded',
                    uploadedUrl: uploadedImage.url,
                    errorMessage: undefined,
                    attempts: attempt,
                }));

                return uploadedImage.url;
            } catch (error) {
                console.error(
                    'Error uploading image:',
                    uploadItem.file.name,
                    error,
                );
                lastErrorMessage =
                    error instanceof Error && error.message
                        ? error.message
                        : 'Spremanje slike nije uspjelo.';
            }
        }

        updateUploadItem(uploadItem.id, (currentUploadItem) => ({
            ...currentUploadItem,
            progress: 0,
            status: 'failed',
            uploadedUrl: undefined,
            errorMessage: lastErrorMessage,
            attempts: MAX_UPLOAD_ATTEMPTS,
        }));

        return null;
    };

    const handleConfirm = async () => {
        try {
            setErrorMessage(null);
            setIsSubmitting(true);
            let shouldResetModalState = false;
            if (attachImages && uploadItems.length > 0) {
                const imageUrls: string[] = [];
                for (const uploadItem of uploadItems) {
                    if (
                        uploadItem.status === 'uploaded' &&
                        uploadItem.uploadedUrl
                    ) {
                        imageUrls.push(uploadItem.uploadedUrl);
                        continue;
                    }

                    const uploadedUrl = await uploadImage(uploadItem);
                    if (!uploadedUrl) {
                        setErrorMessage(
                            'Neke slike nisu učitane. Neuspjele stavke možete pokušati ponovno bez ponovnog odabira.',
                        );
                        return;
                    }

                    imageUrls.push(uploadedUrl);
                }
                setIsOpen(false);
                await completeOperationWithImageUrls(operationId, imageUrls);
                shouldResetModalState = true;
            } else {
                setIsOpen(false);
                await completeOperation(operationId);
                shouldResetModalState = true;
            }
            if (shouldResetModalState) {
                handleOpenChange(false);
            }
        } catch (error) {
            console.error('Error completing operation:', error);
            setIsOpen(true);
            setErrorMessage('Spremanje nije uspjelo. Pokušajte ponovno.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const imageRequirementText = attachImages
        ? attachRequired
            ? 'Slike su obavezne za završetak.'
            : 'Slike su opcionalne za završetak.'
        : null;

    return (
        <Modal
            title="Potvrda završetka radnje"
            open={isOpen}
            onOpenChange={handleOpenChange}
            trigger={
                <Checkbox
                    className="size-5 mx-2"
                    checked={isOpen}
                    onCheckedChange={(checked: boolean) =>
                        handleOpenChange(checked)
                    }
                />
            }
        >
            <Stack spacing={2}>
                <Typography>
                    Jeste li sigurni da želite označiti operaciju kao završenu:{' '}
                    <strong>{label}</strong>?
                </Typography>
                {attachImages && (
                    <Stack spacing={1}>
                        {imageRequirementText && (
                            <Typography level="body2" className="italic">
                                {imageRequirementText}
                            </Typography>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <Button
                            variant="outlined"
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isSubmitting}
                        >
                            {uploadItems.length > 0
                                ? 'Dodaj još slika'
                                : 'Dodaj slike'}
                        </Button>
                        {uploadItems.length > 0 && (
                            <Typography level="body2">
                                Odabrano {uploadItems.length}{' '}
                                {uploadItems.length === 1 ? 'slika' : 'slike'}
                            </Typography>
                        )}
                        {uploadItems.length > 0 && (
                            <Stack spacing={1}>
                                {uploadItems.map((uploadItem) => {
                                    const progress =
                                        uploadItem.status === 'uploaded'
                                            ? 100
                                            : clampUploadProgress(
                                                  uploadItem.progress,
                                              );

                                    return (
                                        <div
                                            key={uploadItem.id}
                                            className="rounded-md border px-3 py-2"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <Typography
                                                        level="body2"
                                                        className="truncate"
                                                    >
                                                        {uploadItem.file.name}
                                                    </Typography>
                                                    <Typography
                                                        level="body2"
                                                        className={`text-xs ${getUploadItemStatusClassName(uploadItem)}`}
                                                    >
                                                        {getUploadItemStatusLabel(
                                                            uploadItem,
                                                        )}
                                                    </Typography>
                                                </div>
                                                <Typography
                                                    level="body2"
                                                    className="text-xs text-muted-foreground"
                                                >
                                                    {progress}%
                                                </Typography>
                                            </div>
                                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className={`h-full transition-[width] duration-200 ${getUploadItemProgressClassName(uploadItem)}`}
                                                    style={{
                                                        width: `${progress}%`,
                                                    }}
                                                />
                                            </div>
                                            {uploadItem.status === 'failed' &&
                                                !isSubmitting && (
                                                    <div className="mt-2">
                                                        <Button
                                                            variant="outlined"
                                                            type="button"
                                                            onClick={() =>
                                                                resetUploadItem(
                                                                    uploadItem.id,
                                                                )
                                                            }
                                                        >
                                                            Pokušaj ponovno
                                                        </Button>
                                                    </div>
                                                )}
                                        </div>
                                    );
                                })}
                            </Stack>
                        )}
                        {isSubmitting && (
                            <Typography level="body2">
                                Učitavanje slika u tijeku...
                            </Typography>
                        )}
                    </Stack>
                )}
                {errorMessage && (
                    <Typography level="body2" className="text-red-600">
                        {errorMessage}
                    </Typography>
                )}
                <Row spacing={1} justifyContent="end">
                    <Button
                        variant="outlined"
                        onClick={() => handleOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Odustani
                    </Button>
                    <Button
                        variant="solid"
                        onClick={handleConfirm}
                        disabled={
                            isSubmitting ||
                            (attachRequired && uploadItems.length === 0)
                        }
                        loading={isSubmitting}
                    >
                        {hasFailedUploads ? 'Pokušaj ponovno' : 'Potvrdi'}
                    </Button>
                </Row>
            </Stack>
        </Modal>
    );
}
