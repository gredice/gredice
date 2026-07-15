'use client';

import type { EntityStandardized } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { upload } from '@vercel/blob/client';
import { useRef, useState } from 'react';
import {
    completeFarmOperation,
    completeFarmOperationWithImageUrls,
} from './actions';

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
const MAX_COMPLETION_NOTES_LENGTH = 2000;

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

interface CompleteOperationModalProps {
    operationId: number;
    label: string;
    conditions?: EntityStandardized['conditions'];
}

export function CompleteOperationModal({
    operationId,
    label,
    conditions,
}: CompleteOperationModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const attachImages = Boolean(
        conditions?.completionAttachImages ||
            conditions?.completionAttachImagesRequired,
    );
    const attachImagesRequired = Boolean(
        conditions?.completionAttachImagesRequired,
    );
    const attachNotes = Boolean(
        conditions?.completionAttachNotes ||
            conditions?.completionAttachNotesRequired,
    );
    const attachNotesRequired = Boolean(
        conditions?.completionAttachNotesRequired,
    );
    const trimmedNotes = notes.trim();
    const notesRequiredMissing =
        attachNotesRequired && trimmedNotes.length === 0;
    const hasFailedUploads = uploadItems.some(
        (uploadItem) => uploadItem.status === 'failed',
    );

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        setErrorMessage(null);
        if (!open) {
            setUploadItems([]);
            setNotes('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (cameraInputRef.current) cameraInputRef.current.value = '';
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const nextUploadItems = Array.from(event.target.files).map(
                createUploadItem,
            );
            setUploadItems((currentUploadItems) => [
                ...currentUploadItems,
                ...nextUploadItems,
            ]);
            setErrorMessage(null);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
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
            if (notesRequiredMissing) {
                setErrorMessage('Napomena je obavezna za završetak.');
                return;
            }

            setIsSubmitting(true);
            const completionNotes = attachNotes ? trimmedNotes : undefined;
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
                await completeFarmOperationWithImageUrls(
                    operationId,
                    imageUrls,
                    completionNotes,
                );
            } else {
                await completeFarmOperation(
                    operationId,
                    undefined,
                    completionNotes,
                );
            }
            handleOpenChange(false);
        } catch (error) {
            console.error('Error completing operation:', error);
            setErrorMessage('Spremanje nije uspjelo. Pokušajte ponovno.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const imageRequirementText = attachImages
        ? attachImagesRequired
            ? 'Slike su obavezne za završetak.'
            : 'Slike su opcionalne za završetak.'
        : null;
    const notesRequirementText = attachNotes
        ? attachNotesRequired
            ? 'Napomena je obavezna za završetak.'
            : 'Napomena je opcionalna za završetak.'
        : null;

    return (
        <Modal
            title="Potvrda završetka radnje"
            open={isOpen}
            onOpenChange={handleOpenChange}
            trigger={
                <Checkbox
                    aria-label={`Dovrši: ${label}`}
                    className="size-5"
                    checked={isOpen}
                    onCheckedChange={(checked: boolean) =>
                        handleOpenChange(checked)
                    }
                />
            }
        >
            <Stack spacing={4}>
                <Typography>
                    Jeste li sigurni da želite označiti operaciju kao završenu:{' '}
                    <strong>{label}</strong>?
                </Typography>
                {attachImages && (
                    <Stack spacing={2}>
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
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <Button
                            variant="outlined"
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            disabled={isSubmitting}
                        >
                            Uslikaj fotografiju
                        </Button>
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
                            <Stack spacing={2}>
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
                {attachNotes && (
                    <Stack spacing={2}>
                        {notesRequirementText && (
                            <Typography level="body2" className="italic">
                                {notesRequirementText}
                            </Typography>
                        )}
                        <textarea
                            value={notes}
                            onChange={(event) => {
                                setNotes(event.target.value);
                                setErrorMessage(null);
                            }}
                            placeholder="Upišite napomenu o završetku..."
                            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                            rows={3}
                            maxLength={MAX_COMPLETION_NOTES_LENGTH}
                            disabled={isSubmitting}
                            required={attachNotesRequired}
                        />
                        <Typography
                            level="body2"
                            className="text-xs text-muted-foreground"
                        >
                            {notes.length}/{MAX_COMPLETION_NOTES_LENGTH}
                        </Typography>
                    </Stack>
                )}
                {errorMessage && (
                    <Typography level="body2" className="text-red-600">
                        {errorMessage}
                    </Typography>
                )}
                <Row
                    spacing={2}
                    justifyContent="end"
                    className="flex-wrap gap-y-2"
                >
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
                            (attachImagesRequired &&
                                uploadItems.length === 0) ||
                            notesRequiredMissing
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

export default CompleteOperationModal;
