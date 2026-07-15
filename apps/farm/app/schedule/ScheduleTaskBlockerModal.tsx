'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Modal } from '@gredice/ui/Modal';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { upload } from '@vercel/blob/client';
import { useRef, useState } from 'react';
import {
    blockFarmScheduleTask,
    refreshFarmScheduleAfterSubmission,
    validateFarmScheduleBlockerUploadTarget,
} from './actions';
import {
    getScheduleTaskBlockerTargetKey,
    getScheduleTaskBlockerTargetLabel,
    type ScheduleTaskBlockerReasonCode,
    type ScheduleTaskBlockerTarget,
    scheduleTaskBlockerReasonRequiresNote,
    scheduleTaskBlockerReasons,
} from './scheduleTaskBlocker';
import {
    getScheduleTaskBlockerImageFileError,
    getScheduleTaskBlockerImagePathPrefix,
    MAX_SCHEDULE_TASK_BLOCKER_IMAGE_COUNT,
} from './scheduleTaskBlockerProof';
import type { ScheduleTaskSubmissionFailure } from './scheduleTaskSubmissionResult';

type BlockerPhotoStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

type BlockerPhoto = {
    attempts: number;
    errorMessage?: string;
    file: File;
    id: string;
    progress: number;
    status: BlockerPhotoStatus;
    uploadedUrl?: string;
};

type BlockerPhotoUploadResult =
    | { failure: ScheduleTaskSubmissionFailure; url: null }
    | { failure: null; url: string | null };

const MAX_UPLOAD_ATTEMPTS = 3;
const MULTIPART_UPLOAD_THRESHOLD_BYTES = 5 * 1024 * 1024;
const MAX_BLOCKER_NOTE_LENGTH = 2000;

function createBlockerPhoto(file: File): BlockerPhoto {
    return {
        attempts: 0,
        file,
        id: crypto.randomUUID(),
        progress: 0,
        status: 'pending',
    };
}

function clampProgress(progress: number) {
    return Math.max(0, Math.min(100, Math.round(progress)));
}

function photoStatusLabel(photo: BlockerPhoto) {
    switch (photo.status) {
        case 'uploaded':
            return 'Učitano';
        case 'uploading':
            return `Učitavanje ${clampProgress(photo.progress)}%`;
        case 'failed':
            return photo.errorMessage
                ? `Neuspjelo: ${photo.errorMessage}`
                : 'Učitavanje nije uspjelo';
        default:
            return 'Spremno za učitavanje';
    }
}

interface ScheduleTaskBlockerModalProps {
    defaultOpen?: boolean;
    label: string;
    target: ScheduleTaskBlockerTarget;
}

export function ScheduleTaskBlockerModal({
    defaultOpen = false,
    label,
    target,
}: ScheduleTaskBlockerModalProps) {
    const [open, setOpen] = useState(defaultOpen);
    const [reasonCode, setReasonCode] =
        useState<ScheduleTaskBlockerReasonCode>();
    const [note, setNote] = useState('');
    const [photos, setPhotos] = useState<BlockerPhoto[]>([]);
    const [selectionMessage, setSelectionMessage] = useState<string>();
    const [errorMessage, setErrorMessage] = useState<string>();
    const [requiresRefresh, setRequiresRefresh] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string>();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const submissionInFlightRef = useRef(false);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const errorRef = useRef<HTMLDivElement>(null);

    const targetLabel = getScheduleTaskBlockerTargetLabel(target);
    const noteRequired = reasonCode
        ? scheduleTaskBlockerReasonRequiresNote(reasonCode)
        : false;
    const trimmedNote = note.trim();
    const noteMissing = noteRequired && trimmedNote.length === 0;
    const imageLimitReached =
        photos.length >= MAX_SCHEDULE_TASK_BLOCKER_IMAGE_COUNT;

    const focusError = () => {
        requestAnimationFrame(() => errorRef.current?.focus());
    };

    const clearError = () => {
        if (requiresRefresh) {
            return;
        }
        setErrorMessage(undefined);
    };

    const updatePhoto = (
        photoId: string,
        updater: (photo: BlockerPhoto) => BlockerPhoto,
    ) => {
        setPhotos((currentPhotos) =>
            currentPhotos.map((photo) =>
                photo.id === photoId ? updater(photo) : photo,
            ),
        );
    };

    const markUploadTargetFailure = (
        photoId: string,
        failure: ScheduleTaskSubmissionFailure,
    ) => {
        updatePhoto(photoId, (currentPhoto) => ({
            ...currentPhoto,
            errorMessage: failure.message,
            progress: 0,
            status: 'failed',
            uploadedUrl: undefined,
        }));
    };

    const markStoredPhotosForRetry = (imageUrls: string[] | undefined) => {
        if (!imageUrls || imageUrls.length === 0) {
            return;
        }
        const retryUrls = new Set(imageUrls);
        setPhotos((currentPhotos) =>
            currentPhotos.map((photo) =>
                photo.uploadedUrl && retryUrls.has(photo.uploadedUrl)
                    ? {
                          ...photo,
                          attempts: 0,
                          errorMessage:
                              'Fotografiju treba ponovno učitati. Pokušaj ponovno.',
                          progress: 0,
                          status: 'failed',
                          uploadedUrl: undefined,
                      }
                    : photo,
            ),
        );
    };

    const handleFilesSelected = (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const selectedFiles = Array.from(event.target.files ?? []);
        const acceptedFiles = selectedFiles.filter(
            (file) => getScheduleTaskBlockerImageFileError(file) === null,
        );
        const rejectedFileErrors = selectedFiles
            .map(getScheduleTaskBlockerImageFileError)
            .filter((message) => message !== null);
        const availableSlots = Math.max(
            0,
            MAX_SCHEDULE_TASK_BLOCKER_IMAGE_COUNT - photos.length,
        );
        const selectionMessages = [
            rejectedFileErrors[0]
                ? `${rejectedFileErrors[0]} Odaberi drugu fotografiju.`
                : null,
            acceptedFiles.length > availableSlots
                ? `Možeš dodati najviše ${MAX_SCHEDULE_TASK_BLOCKER_IMAGE_COUNT} fotografija. Višak nije dodan.`
                : null,
        ].filter((message): message is string => Boolean(message));
        setSelectionMessage(selectionMessages.join(' ') || undefined);
        setPhotos((currentPhotos) => {
            const currentAvailableSlots = Math.max(
                0,
                MAX_SCHEDULE_TASK_BLOCKER_IMAGE_COUNT - currentPhotos.length,
            );
            return [
                ...currentPhotos,
                ...acceptedFiles
                    .slice(0, currentAvailableSlots)
                    .map(createBlockerPhoto),
            ];
        });
        clearError();
        if (galleryInputRef.current) galleryInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const removePhoto = (photoId: string) => {
        setPhotos((currentPhotos) =>
            currentPhotos.filter((photo) => photo.id !== photoId),
        );
        setSelectionMessage(undefined);
        clearError();
    };

    const uploadPhoto = async (
        photo: BlockerPhoto,
    ): Promise<BlockerPhotoUploadResult> => {
        const extension = photo.file.name.includes('.')
            ? photo.file.name.slice(photo.file.name.lastIndexOf('.'))
            : '';
        let lastErrorMessage = 'Spremanje fotografije nije uspjelo.';

        const initialTargetValidation =
            await validateFarmScheduleBlockerUploadTarget(target);
        if (!initialTargetValidation.success) {
            markUploadTargetFailure(photo.id, initialTargetValidation);
            return { failure: initialTargetValidation, url: null };
        }

        for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt++) {
            updatePhoto(photo.id, (currentPhoto) => ({
                ...currentPhoto,
                attempts: attempt,
                errorMessage: undefined,
                progress: 0,
                status: 'uploading',
            }));

            try {
                const pathname = `${getScheduleTaskBlockerImagePathPrefix(target)}${photo.id}-${attempt}${extension}`;
                const uploadedPhoto = await upload(pathname, photo.file, {
                    access: 'public',
                    clientPayload: JSON.stringify(target),
                    contentType: photo.file.type || undefined,
                    handleUploadUrl: '/api/schedule/blocker-images/upload',
                    multipart:
                        photo.file.size > MULTIPART_UPLOAD_THRESHOLD_BYTES,
                    onUploadProgress: ({ percentage }) => {
                        updatePhoto(photo.id, (currentPhoto) => ({
                            ...currentPhoto,
                            attempts: attempt,
                            progress: clampProgress(percentage),
                            status: 'uploading',
                        }));
                    },
                });

                updatePhoto(photo.id, (currentPhoto) => ({
                    ...currentPhoto,
                    attempts: attempt,
                    errorMessage: undefined,
                    progress: 100,
                    status: 'uploaded',
                    uploadedUrl: uploadedPhoto.url,
                }));
                return { failure: null, url: uploadedPhoto.url };
            } catch (error) {
                console.error(
                    'Error uploading schedule blocker photo:',
                    photo.file.name,
                    error,
                );
                lastErrorMessage =
                    'Spremanje fotografije nije uspjelo. Pokušaj ponovno.';
                const currentTargetValidation =
                    await validateFarmScheduleBlockerUploadTarget(target);
                if (!currentTargetValidation.success) {
                    markUploadTargetFailure(photo.id, currentTargetValidation);
                    return { failure: currentTargetValidation, url: null };
                }
            }
        }

        updatePhoto(photo.id, (currentPhoto) => ({
            ...currentPhoto,
            attempts: MAX_UPLOAD_ATTEMPTS,
            errorMessage: lastErrorMessage,
            progress: 0,
            status: 'failed',
            uploadedUrl: undefined,
        }));
        return { failure: null, url: null };
    };

    const handleSubmit = async () => {
        if (submissionInFlightRef.current) {
            return;
        }
        if (!reasonCode) {
            setErrorMessage('Odaberi razlog zbog kojeg zadatak nije dovršen.');
            focusError();
            return;
        }
        if (noteMissing) {
            setErrorMessage('Za odabrani razlog napiši kratko objašnjenje.');
            focusError();
            return;
        }

        submissionInFlightRef.current = true;
        setIsSubmitting(true);
        setRequiresRefresh(false);
        clearError();

        try {
            const imageUrls: string[] = [];
            for (const photo of photos) {
                if (photo.status === 'uploaded' && photo.uploadedUrl) {
                    imageUrls.push(photo.uploadedUrl);
                    continue;
                }

                const uploadResult = await uploadPhoto(photo);
                if (uploadResult.failure) {
                    setErrorMessage(uploadResult.failure.message);
                    setRequiresRefresh(!uploadResult.failure.canRetry);
                    focusError();
                    return;
                }
                if (!uploadResult.url) {
                    setErrorMessage(
                        'Fotografija nije učitana. Pokušaj ponovno bez ponovnog odabira.',
                    );
                    focusError();
                    return;
                }
                imageUrls.push(uploadResult.url);
            }

            const result = await blockFarmScheduleTask(
                target,
                reasonCode,
                trimmedNote || undefined,
                imageUrls.length > 0 ? imageUrls : undefined,
            );
            if (!result.success) {
                markStoredPhotosForRetry(result.retryImageUrls);
                setErrorMessage(result.message);
                setRequiresRefresh(!result.canRetry);
                focusError();
                return;
            }
            setSuccessMessage(
                `Prepreka za ${targetLabel} „${label}” prijavljena je administratorima. Status: Blokirano.`,
            );
        } catch (error) {
            console.error('Error blocking farm schedule task:', error);
            setErrorMessage(
                'Nije spremljeno. Provjeri vezu i pokušaj ponovno.',
            );
            setRequiresRefresh(false);
            focusError();
        } finally {
            submissionInFlightRef.current = false;
            setIsSubmitting(false);
        }
    };

    const resetDraft = () => {
        setReasonCode(undefined);
        setNote('');
        setPhotos([]);
        setSelectionMessage(undefined);
        setErrorMessage(undefined);
        setRequiresRefresh(false);
        setSuccessMessage(undefined);
    };

    const finishSuccess = () => {
        resetDraft();
        setOpen(false);
        void refreshFarmScheduleAfterSubmission().catch((error) => {
            console.error('Error refreshing blocked task:', error);
            window.location.reload();
        });
    };

    const refreshTasks = () => {
        resetDraft();
        setOpen(false);
        window.location.reload();
    };

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen && submissionInFlightRef.current) {
            return;
        }
        if (!nextOpen && successMessage) {
            finishSuccess();
            return;
        }
        if (!nextOpen && !requiresRefresh) {
            setErrorMessage(undefined);
        }
        setOpen(nextOpen);
    };

    return (
        <Modal
            dismissible={!isSubmitting}
            open={open}
            onOpenChange={handleOpenChange}
            title="Prijavi prepreku"
            trigger={
                <Button
                    aria-label={`Ne mogu dovršiti ${targetLabel}: ${label}`}
                    className="h-auto min-h-11 whitespace-normal border-amber-500 py-2 text-amber-800 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40 [overflow-wrap:anywhere]"
                    fullWidth
                    size="lg"
                    type="button"
                    variant="outlined"
                >
                    Ne mogu dovršiti
                </Button>
            }
        >
            {successMessage ? (
                <Stack spacing={4}>
                    <h2 className="text-lg font-semibold">
                        Prepreka spremljena
                    </h2>
                    <Alert color="success" role="status">
                        {successMessage}
                    </Alert>
                    <Button
                        fullWidth
                        onClick={finishSuccess}
                        size="lg"
                        type="button"
                        variant="solid"
                    >
                        U redu
                    </Button>
                </Stack>
            ) : (
                <Stack spacing={4}>
                    <div>
                        <h2 className="text-lg font-semibold">
                            Prijavi prepreku
                        </h2>
                        <Typography
                            className="mt-1 [overflow-wrap:anywhere]"
                            level="body2"
                        >
                            Zadatak: <strong>{label}</strong>
                        </Typography>
                    </div>

                    <fieldset disabled={isSubmitting} className="space-y-2">
                        <legend className="mb-2 text-sm font-semibold">
                            Zašto zadatak ne može biti dovršen?
                        </legend>
                        {scheduleTaskBlockerReasons.map((reason) => (
                            <label
                                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                                key={reason.code}
                            >
                                <input
                                    checked={reasonCode === reason.code}
                                    className="size-5 shrink-0"
                                    name={`blocker-reason-${getScheduleTaskBlockerTargetKey(target)}`}
                                    onChange={() => {
                                        setReasonCode(reason.code);
                                        clearError();
                                    }}
                                    type="radio"
                                    value={reason.code}
                                />
                                <span className="min-w-0 [overflow-wrap:anywhere]">
                                    {reason.label}
                                </span>
                            </label>
                        ))}
                    </fieldset>

                    <label className="space-y-1 text-sm font-medium">
                        Napomena{noteRequired ? ' (obavezno)' : ' (opcionalno)'}
                        <textarea
                            aria-invalid={noteMissing || undefined}
                            className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-base font-normal focus:outline-hidden focus:ring-2 focus:ring-primary"
                            disabled={isSubmitting}
                            maxLength={MAX_BLOCKER_NOTE_LENGTH}
                            onChange={(event) => {
                                setNote(event.target.value);
                                clearError();
                            }}
                            placeholder="Dodaj kratko objašnjenje za administratora..."
                            required={noteRequired}
                            value={note}
                        />
                        <span className="block text-xs font-normal text-muted-foreground">
                            {note.length}/{MAX_BLOCKER_NOTE_LENGTH}
                        </span>
                    </label>

                    <Stack spacing={2}>
                        <Typography level="body2" semiBold>
                            Fotografija (opcionalno)
                        </Typography>
                        <input
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={handleFilesSelected}
                            ref={cameraInputRef}
                            type="file"
                        />
                        <input
                            accept="image/*"
                            className="hidden"
                            multiple
                            onChange={handleFilesSelected}
                            ref={galleryInputRef}
                            type="file"
                        />
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <Button
                                disabled={isSubmitting || imageLimitReached}
                                onClick={() => cameraInputRef.current?.click()}
                                size="lg"
                                type="button"
                                variant="outlined"
                            >
                                Uslikaj fotografiju
                            </Button>
                            <Button
                                disabled={isSubmitting || imageLimitReached}
                                onClick={() => galleryInputRef.current?.click()}
                                size="lg"
                                type="button"
                                variant="outlined"
                            >
                                Dodaj iz galerije
                            </Button>
                        </div>
                        {selectionMessage ? (
                            <Alert color="warning" role="alert">
                                {selectionMessage}
                            </Alert>
                        ) : null}
                        {photos.map((photo, index) => {
                            const ordinal = index + 1;
                            const progress =
                                photo.status === 'uploaded'
                                    ? 100
                                    : clampProgress(photo.progress);
                            return (
                                <div
                                    className="rounded-md border px-3 py-2"
                                    data-blocker-photo
                                    key={photo.id}
                                >
                                    <Typography level="body2" semiBold>
                                        Fotografija {ordinal}
                                    </Typography>
                                    <Typography
                                        className="truncate"
                                        level="body2"
                                        title={photo.file.name}
                                    >
                                        {photo.file.name}
                                    </Typography>
                                    <Typography
                                        aria-live={
                                            photo.status === 'failed'
                                                ? 'assertive'
                                                : 'polite'
                                        }
                                        className={
                                            photo.status === 'failed'
                                                ? 'text-red-700 dark:text-red-300'
                                                : 'text-muted-foreground'
                                        }
                                        level="body3"
                                    >
                                        {photoStatusLabel(photo)}
                                    </Typography>
                                    <div
                                        aria-label={`Učitavanje fotografije ${ordinal}`}
                                        aria-valuemax={100}
                                        aria-valuemin={0}
                                        aria-valuenow={progress}
                                        className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                                        role="progressbar"
                                    >
                                        <div
                                            className="h-full bg-primary transition-[width]"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    {!isSubmitting ? (
                                        <Button
                                            aria-label={`Ukloni fotografiju ${ordinal}: ${photo.file.name}`}
                                            className="mt-2"
                                            onClick={() =>
                                                removePhoto(photo.id)
                                            }
                                            size="lg"
                                            type="button"
                                            variant="plain"
                                        >
                                            Ukloni
                                        </Button>
                                    ) : null}
                                </div>
                            );
                        })}
                    </Stack>

                    {errorMessage ? (
                        <div
                            data-schedule-submission-error
                            ref={errorRef}
                            tabIndex={-1}
                        >
                            <Alert color="danger" role="alert">
                                {errorMessage}
                            </Alert>
                        </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button
                            disabled={isSubmitting}
                            onClick={() => handleOpenChange(false)}
                            size="lg"
                            type="button"
                            variant="outlined"
                        >
                            Odustani
                        </Button>
                        <Button
                            aria-busy={isSubmitting}
                            disabled={
                                isSubmitting || !reasonCode || noteMissing
                            }
                            loading={isSubmitting}
                            onClick={
                                requiresRefresh ? refreshTasks : handleSubmit
                            }
                            size="lg"
                            type="button"
                            variant="solid"
                        >
                            {errorMessage
                                ? requiresRefresh
                                    ? 'Osvježi zadatke'
                                    : 'Pokušaj ponovno'
                                : 'Prijavi prepreku'}
                        </Button>
                    </div>
                    <Typography
                        className="text-center text-muted-foreground"
                        level="body3"
                    >
                        Unos ostaje sačuvan ako zatvoriš ovaj prozor prije
                        slanja.
                    </Typography>
                </Stack>
            )}
        </Modal>
    );
}
