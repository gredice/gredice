'use client';

import type { EntityStandardized } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
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
import { MAX_FARM_OPERATION_COMPLETION_IMAGE_COUNT } from './operationCompletionProof';
import { ScheduleTaskCompletionButton } from './ScheduleTaskCompletionButton';
import {
    getScheduleOperationCompletionRequirements,
    isScheduleOperationRequirementVisible,
} from './scheduleOperationRequirements';
import { getScheduleOperationProofRequirementsId } from './scheduleTaskIds';

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
    defaultOpen?: boolean;
}

export function CompleteOperationModal({
    operationId,
    label,
    conditions,
    defaultOpen = false,
}: CompleteOperationModalProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [imageSelectionMessage, setImageSelectionMessage] = useState<
        string | null
    >(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const submissionInFlightRef = useRef(false);

    const requirements = getScheduleOperationCompletionRequirements({
        conditions,
    });
    const attachImages = isScheduleOperationRequirementVisible(
        requirements.images,
    );
    const attachImagesRequired = requirements.images === 'required';
    const attachNotes = isScheduleOperationRequirementVisible(
        requirements.notes,
    );
    const attachNotesRequired = requirements.notes === 'required';
    const proofRequirementsId =
        attachImages || attachNotes
            ? getScheduleOperationProofRequirementsId(operationId)
            : undefined;
    const trimmedNotes = notes.trim();
    const notesRequiredMissing =
        attachNotesRequired && trimmedNotes.length === 0;
    const hasFailedUploads = uploadItems.some(
        (uploadItem) => uploadItem.status === 'failed',
    );
    const imageLimitReached =
        uploadItems.length >= MAX_FARM_OPERATION_COMPLETION_IMAGE_COUNT;

    const handleOpenChange = (open: boolean) => {
        if (!open && submissionInFlightRef.current) {
            return;
        }

        setIsOpen(open);
        setErrorMessage(null);
        setImageSelectionMessage(null);
        if (!open) {
            setUploadItems([]);
            setNotes('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (cameraInputRef.current) cameraInputRef.current.value = '';
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const selectedFiles = Array.from(event.target.files);
            const availableSlots = Math.max(
                0,
                MAX_FARM_OPERATION_COMPLETION_IMAGE_COUNT - uploadItems.length,
            );
            setUploadItems((currentUploadItems) => {
                const remainingSlots = Math.max(
                    0,
                    MAX_FARM_OPERATION_COMPLETION_IMAGE_COUNT -
                        currentUploadItems.length,
                );
                return [
                    ...currentUploadItems,
                    ...selectedFiles
                        .slice(0, remainingSlots)
                        .map(createUploadItem),
                ];
            });
            setImageSelectionMessage(
                selectedFiles.length > availableSlots
                    ? `Možeš dodati najviše ${MAX_FARM_OPERATION_COMPLETION_IMAGE_COUNT} fotografija. Višak nije dodan.`
                    : null,
            );
            setErrorMessage(null);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const removeUploadItem = (uploadItemId: string) => {
        setUploadItems((currentUploadItems) =>
            currentUploadItems.filter(
                (uploadItem) => uploadItem.id !== uploadItemId,
            ),
        );
        setImageSelectionMessage(null);
        setErrorMessage(null);
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
        if (submissionInFlightRef.current) {
            return;
        }

        try {
            setErrorMessage(null);
            if (notesRequiredMissing) {
                setErrorMessage('Napomena je obavezna za završetak.');
                return;
            }

            submissionInFlightRef.current = true;
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
            submissionInFlightRef.current = false;
            handleOpenChange(false);
        } catch (error) {
            console.error('Error completing operation:', error);
            setErrorMessage('Spremanje nije uspjelo. Pokušajte ponovno.');
        } finally {
            submissionInFlightRef.current = false;
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
            dismissible={!isSubmitting}
            open={isOpen}
            onOpenChange={handleOpenChange}
            trigger={
                <ScheduleTaskCompletionButton
                    actionLabel="Dovrši radnju"
                    aria-describedby={proofRequirementsId}
                    label={label}
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
                            disabled={isSubmitting || imageLimitReached}
                            size="lg"
                        >
                            Uslikaj fotografiju
                        </Button>
                        <Button
                            variant="outlined"
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isSubmitting || imageLimitReached}
                            size="lg"
                        >
                            {uploadItems.length > 0
                                ? 'Dodaj još slika'
                                : 'Dodaj slike'}
                        </Button>
                        {uploadItems.length > 0 && (
                            <Typography level="body2">
                                Odabrano {uploadItems.length} od najviše{' '}
                                {MAX_FARM_OPERATION_COMPLETION_IMAGE_COUNT}{' '}
                                fotografija
                            </Typography>
                        )}
                        {imageSelectionMessage && (
                            <Typography
                                aria-live="assertive"
                                className="text-amber-700 dark:text-amber-300"
                                data-image-selection-message
                                level="body2"
                                role="alert"
                            >
                                {imageSelectionMessage}
                            </Typography>
                        )}
                        {uploadItems.length > 0 && (
                            <Stack spacing={2}>
                                {uploadItems.map((uploadItem, index) => {
                                    const ordinal = index + 1;
                                    const progress =
                                        uploadItem.status === 'uploaded'
                                            ? 100
                                            : clampUploadProgress(
                                                  uploadItem.progress,
                                              );

                                    return (
                                        <div
                                            data-operation-upload-item
                                            key={uploadItem.id}
                                            className="rounded-md border px-3 py-2"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <Typography
                                                        className="text-foreground"
                                                        level="body2"
                                                        semiBold
                                                    >
                                                        Fotografija {ordinal}
                                                    </Typography>
                                                    <Typography
                                                        level="body2"
                                                        className="truncate"
                                                        title={
                                                            uploadItem.file.name
                                                        }
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
                                                            size="lg"
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
                                            {!isSubmitting && (
                                                <div className="mt-2">
                                                    <Button
                                                        aria-label={`Ukloni fotografiju ${ordinal}: ${uploadItem.file.name}`}
                                                        onClick={() =>
                                                            removeUploadItem(
                                                                uploadItem.id,
                                                            )
                                                        }
                                                        size="lg"
                                                        type="button"
                                                        variant="plain"
                                                    >
                                                        Ukloni
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
                        size="lg"
                    >
                        Odustani
                    </Button>
                    <Button
                        variant="solid"
                        aria-busy={isSubmitting}
                        onClick={handleConfirm}
                        disabled={
                            isSubmitting ||
                            (attachImagesRequired &&
                                uploadItems.length === 0) ||
                            notesRequiredMissing
                        }
                        loading={isSubmitting}
                        size="lg"
                    >
                        {hasFailedUploads ? 'Pokušaj ponovno' : 'Potvrdi'}
                    </Button>
                </Row>
            </Stack>
        </Modal>
    );
}

export default CompleteOperationModal;
