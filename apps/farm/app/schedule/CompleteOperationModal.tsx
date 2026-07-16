'use client';

import type { EntityStandardized } from '@gredice/storage';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { upload } from '@vercel/blob/client';
import { useEffect, useRef, useState } from 'react';
import {
    completeFarmOperation,
    completeFarmOperationWithImageUrls,
    refreshFarmScheduleAfterSubmission,
    validateFarmOperationUploadTarget,
} from './actions';
import {
    getFarmOperationCompletionImageFileError,
    getFarmOperationCompletionImagePathPrefix,
    MAX_FARM_OPERATION_COMPLETION_IMAGE_COUNT,
} from './operationCompletionProof';
import { ScheduleTaskCompletionButton } from './ScheduleTaskCompletionButton';
import {
    getScheduleOperationCompletionRequirements,
    getScheduleOperationCompletionRequirementsFingerprint,
    isScheduleOperationRequirementVisible,
} from './scheduleOperationRequirements';
import { getScheduleOperationProofRequirementsId } from './scheduleTaskIds';
import {
    getScheduleTaskCompletionSuccessMessage,
    type ScheduleTaskSubmissionFailure,
} from './scheduleTaskSubmissionResult';
import {
    type OperationCompletionDraftSaveState,
    useOperationCompletionDraft,
} from './useOperationCompletionDraft';

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

type UploadImageResult =
    | { failure: ScheduleTaskSubmissionFailure; url: null }
    | { failure: null; url: string | null };

const MAX_UPLOAD_ATTEMPTS = 3;
const MULTIPART_UPLOAD_THRESHOLD_BYTES = 5 * 1024 * 1024;
const MAX_COMPLETION_NOTES_LENGTH = 2000;

function createUploadItem(file: File, id = crypto.randomUUID()): UploadItem {
    return {
        id,
        file,
        progress: 0,
        status: 'pending',
        attempts: 0,
    };
}

function getLocalDraftSaveErrorMessage(
    reason: Extract<
        OperationCompletionDraftSaveState,
        { kind: 'error' }
    >['reason'],
) {
    switch (reason) {
        case 'draft_count_limit':
            return 'Dosegnuto je ograničenje od 5 lokalnih skica. Otvori drugi zadatak sa skicom i odbaci je prije spremanja nove.';
        case 'draft_size_limit':
            return 'Lokalne skice koriste dopuštenih 100 MB. Ukloni fotografije ili odbaci drugu skicu.';
        case 'draft_changed':
            return 'Lokalna skica promijenila se u drugom prozoru. Pregledaj trenutnu skicu prije nastavka.';
        case 'incompatible':
            return 'Zadatak se promijenio pa se ova lokalna skica ne može spremiti. Osvježi raspored prije nastavka.';
        case 'quota_exceeded':
            return 'Uređaj nema dovoljno prostora za lokalnu skicu. Unos ostaje otvoren, ali možda neće preživjeti osvježavanje.';
        case 'session_changed':
            return 'Sesija je završila. Ovaj unos neće ostati spremljen na uređaju.';
        default:
            return 'Lokalna skica se ne može spremiti na ovom uređaju. Unos ostaje otvoren, ali možda neće preživjeti osvježavanje.';
    }
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
    accountId: string;
    expectedEntityId: number;
    expectedTaskVersionEventId: number;
    operationId: number;
    sessionIncarnation: string;
    label: string;
    conditions?: EntityStandardized['conditions'];
    defaultOpen?: boolean;
    userId: string;
}

export function CompleteOperationModal({
    accountId,
    expectedEntityId,
    expectedTaskVersionEventId,
    operationId,
    sessionIncarnation,
    label,
    conditions,
    defaultOpen = false,
    userId,
}: CompleteOperationModalProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [requiresRefresh, setRequiresRefresh] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [imageSelectionMessage, setImageSelectionMessage] = useState<
        string | null
    >(null);
    const [isResolvingLocalDraft, setIsResolvingLocalDraft] = useState(false);
    const [localDraftCleanupWarning, setLocalDraftCleanupWarning] =
        useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const notesInputRef = useRef<HTMLTextAreaElement>(null);
    const sessionChangedFocusRef = useRef<HTMLDivElement>(null);
    const submissionInFlightRef = useRef(false);
    const errorRef = useRef<HTMLDivElement>(null);
    const previousDraftScopeIdentityRef = useRef<string | null>(null);

    const requirements = getScheduleOperationCompletionRequirements({
        conditions,
    });
    const expectedRequirementsFingerprint =
        getScheduleOperationCompletionRequirementsFingerprint(requirements);
    const localDraft = useOperationCompletionDraft({
        accountId,
        enabled: isOpen,
        expectedEntityId,
        expectedTaskVersionEventId,
        notes,
        operationId,
        photos: uploadItems.map(({ file, id }) => ({ file, id })),
        requirementsFingerprint: expectedRequirementsFingerprint,
        sessionIncarnation,
        userId,
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
    const notesInputId = `operation-${operationId.toString()}-completion-notes`;
    const notesCounterId = `${notesInputId}-counter`;
    const trimmedNotes = notes.trim();
    const notesRequiredMissing =
        attachNotesRequired && trimmedNotes.length === 0;
    const hasFailedUploads = uploadItems.some(
        (uploadItem) => uploadItem.status === 'failed',
    );
    const imageLimitReached =
        uploadItems.length >= MAX_FARM_OPERATION_COMPLETION_IMAGE_COUNT;
    const localDraftBlocksEditing = localDraft.gate.kind !== 'none';
    const draftScopeIdentity = JSON.stringify([
        userId,
        accountId,
        operationId,
        expectedEntityId,
        expectedTaskVersionEventId,
        expectedRequirementsFingerprint,
        sessionIncarnation,
    ]);

    useEffect(() => {
        const previousIdentity = previousDraftScopeIdentityRef.current;
        previousDraftScopeIdentityRef.current = draftScopeIdentity;
        if (
            previousIdentity === null ||
            previousIdentity === draftScopeIdentity
        ) {
            return;
        }
        setNotes('');
        setUploadItems([]);
        setErrorMessage(null);
        setImageSelectionMessage(null);
        setLocalDraftCleanupWarning(false);
    }, [draftScopeIdentity]);

    useEffect(() => {
        if (localDraft.gate.kind !== 'session_changed') {
            return;
        }
        setNotes('');
        setUploadItems([]);
        setErrorMessage(null);
        setImageSelectionMessage(null);
        setLocalDraftCleanupWarning(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        requestAnimationFrame(() => sessionChangedFocusRef.current?.focus());
    }, [localDraft.gate.kind]);

    const focusCompletionForm = () => {
        requestAnimationFrame(() => {
            if (attachNotes) {
                notesInputRef.current?.focus();
                return;
            }
            document
                .querySelector<HTMLButtonElement>(
                    `[data-operation-draft-focus-target="${operationId.toString()}"]`,
                )
                ?.focus();
        });
    };

    const resumeLocalDraft = () => {
        const restoredDraft = localDraft.resume();
        if (!restoredDraft) {
            return;
        }
        setNotes(restoredDraft.notes);
        setUploadItems(
            restoredDraft.photos.map(({ file, id }) =>
                createUploadItem(file, id),
            ),
        );
        setErrorMessage(null);
        setImageSelectionMessage(null);
        focusCompletionForm();
    };

    const discardLocalDraft = async () => {
        setIsResolvingLocalDraft(true);
        try {
            const discarded = await localDraft.discard();
            if (discarded) {
                setNotes('');
                setUploadItems([]);
                setErrorMessage(null);
                setImageSelectionMessage(null);
                focusCompletionForm();
            }
        } finally {
            setIsResolvingLocalDraft(false);
        }
    };

    const resetCompletedDraft = () => {
        setSuccessMessage(null);
        setErrorMessage(null);
        setRequiresRefresh(false);
        setImageSelectionMessage(null);
        setLocalDraftCleanupWarning(false);
        setUploadItems([]);
        setNotes('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const refreshAfterSuccess = () => {
        void refreshFarmScheduleAfterSubmission().catch((error) => {
            console.error('Error refreshing completed task:', error);
            window.location.reload();
        });
    };

    const finishSuccess = () => {
        resetCompletedDraft();
        setIsOpen(false);
        refreshAfterSuccess();
    };

    const handleOpenChange = (open: boolean) => {
        if (!open && submissionInFlightRef.current) {
            return;
        }

        if (!open && successMessage) {
            finishSuccess();
            return;
        }

        setIsOpen(open);
        if (!open && !requiresRefresh) {
            void localDraft.flush();
            setErrorMessage(null);
            setImageSelectionMessage(null);
        }
    };

    const clearRetryableError = () => {
        if (requiresRefresh) {
            return;
        }
        setErrorMessage(null);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const selectedFiles = Array.from(event.target.files);
            const acceptedFiles = selectedFiles.filter(
                (file) =>
                    getFarmOperationCompletionImageFileError(file) === null,
            );
            const rejectedFileErrors = selectedFiles
                .map(getFarmOperationCompletionImageFileError)
                .filter((message) => message !== null);
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
                    ...acceptedFiles
                        .slice(0, remainingSlots)
                        .map((file) => createUploadItem(file)),
                ];
            });
            const selectionMessages = [
                rejectedFileErrors[0]
                    ? `${rejectedFileErrors[0]} Odaberi drugu fotografiju.`
                    : null,
                acceptedFiles.length > availableSlots
                    ? `Možeš dodati najviše ${MAX_FARM_OPERATION_COMPLETION_IMAGE_COUNT} fotografija. Višak nije dodan.`
                    : null,
            ].filter((message): message is string => Boolean(message));
            setImageSelectionMessage(selectionMessages.join(' ') || null);
            clearRetryableError();
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
        clearRetryableError();
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

    const markUploadTargetFailure = (
        uploadItemId: string,
        failure: ScheduleTaskSubmissionFailure,
    ) => {
        updateUploadItem(uploadItemId, (currentUploadItem) => ({
            ...currentUploadItem,
            errorMessage: failure.message,
            progress: 0,
            status: 'failed',
            uploadedUrl: undefined,
        }));
    };

    const markStoredImagesForRetry = (imageUrls: string[] | undefined) => {
        if (!imageUrls || imageUrls.length === 0) {
            return;
        }
        const retryUrls = new Set(imageUrls);
        setUploadItems((currentUploadItems) =>
            currentUploadItems.map((uploadItem) =>
                uploadItem.uploadedUrl && retryUrls.has(uploadItem.uploadedUrl)
                    ? {
                          ...uploadItem,
                          attempts: 0,
                          errorMessage:
                              'Fotografiju treba ponovno učitati. Pokušaj ponovno.',
                          progress: 0,
                          status: 'failed',
                          uploadedUrl: undefined,
                      }
                    : uploadItem,
            ),
        );
    };

    const uploadImage = async (
        uploadItem: UploadItem,
    ): Promise<UploadImageResult> => {
        const extension = uploadItem.file.name.includes('.')
            ? uploadItem.file.name.slice(uploadItem.file.name.lastIndexOf('.'))
            : '';
        let lastErrorMessage = 'Spremanje slike nije uspjelo.';

        const initialTargetValidation = await validateFarmOperationUploadTarget(
            operationId,
            expectedEntityId,
            expectedTaskVersionEventId,
            expectedRequirementsFingerprint,
        );
        if (!initialTargetValidation.success) {
            markUploadTargetFailure(uploadItem.id, initialTargetValidation);
            return { failure: initialTargetValidation, url: null };
        }

        for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt++) {
            const pathname = `${getFarmOperationCompletionImagePathPrefix(operationId, expectedEntityId, expectedTaskVersionEventId)}${uploadItem.id}-${attempt}${extension}`;

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
                    clientPayload: JSON.stringify({
                        expectedEntityId,
                        expectedRequirementsFingerprint,
                        expectedTaskVersionEventId,
                        operationId,
                    }),
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

                return { failure: null, url: uploadedImage.url };
            } catch {
                console.error('Error uploading completion image.');
                lastErrorMessage =
                    'Spremanje fotografije nije uspjelo. Pokušaj ponovno.';
                const currentTargetValidation =
                    await validateFarmOperationUploadTarget(
                        operationId,
                        expectedEntityId,
                        expectedTaskVersionEventId,
                        expectedRequirementsFingerprint,
                    );
                if (!currentTargetValidation.success) {
                    markUploadTargetFailure(
                        uploadItem.id,
                        currentTargetValidation,
                    );
                    return { failure: currentTargetValidation, url: null };
                }
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

        return { failure: null, url: null };
    };

    const handleConfirm = async () => {
        if (submissionInFlightRef.current || localDraftBlocksEditing) {
            return;
        }

        try {
            setErrorMessage(null);
            setRequiresRefresh(false);
            if (notesRequiredMissing) {
                setErrorMessage('Napomena je obavezna za završetak.');
                return;
            }

            submissionInFlightRef.current = true;
            setIsSubmitting(true);
            const completionNotes = attachNotes ? trimmedNotes : undefined;
            let result: Awaited<ReturnType<typeof completeFarmOperation>>;
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

                    const uploadResult = await uploadImage(uploadItem);
                    if (uploadResult.failure) {
                        setErrorMessage(uploadResult.failure.message);
                        setRequiresRefresh(!uploadResult.failure.canRetry);
                        requestAnimationFrame(() => errorRef.current?.focus());
                        return;
                    }
                    if (!uploadResult.url) {
                        setErrorMessage(
                            'Neke slike nisu učitane. Neuspjele stavke možete pokušati ponovno bez ponovnog odabira.',
                        );
                        requestAnimationFrame(() => errorRef.current?.focus());
                        return;
                    }

                    imageUrls.push(uploadResult.url);
                }
                result = await completeFarmOperationWithImageUrls(
                    operationId,
                    expectedEntityId,
                    expectedTaskVersionEventId,
                    expectedRequirementsFingerprint,
                    imageUrls,
                    completionNotes,
                );
            } else {
                result = await completeFarmOperation(
                    operationId,
                    expectedEntityId,
                    expectedTaskVersionEventId,
                    expectedRequirementsFingerprint,
                    undefined,
                    completionNotes,
                );
            }
            if (!result.success) {
                markStoredImagesForRetry(result.retryImageUrls);
                setErrorMessage(result.message);
                setRequiresRefresh(!result.canRetry);
                requestAnimationFrame(() => errorRef.current?.focus());
                return;
            }
            const localConfirmationSucceeded =
                await localDraft.discardAfterServerSuccess();
            setLocalDraftCleanupWarning(!localConfirmationSucceeded);
            setSuccessMessage(
                getScheduleTaskCompletionSuccessMessage({
                    kind: 'operation',
                    label,
                    state: result.state,
                }),
            );
        } catch (error) {
            console.error('Error completing operation:', error);
            setErrorMessage(
                'Radnja nije spremljena. Provjeri vezu i pokušaj ponovno.',
            );
            setRequiresRefresh(false);
            requestAnimationFrame(() => errorRef.current?.focus());
        } finally {
            submissionInFlightRef.current = false;
            setIsSubmitting(false);
        }
    };

    const refreshTasks = () => {
        resetCompletedDraft();
        setIsOpen(false);
        window.location.reload();
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
            {successMessage ? (
                <Stack spacing={4}>
                    <h2 className="text-lg font-semibold">Radnja spremljena</h2>
                    <Alert color="success" role="status">
                        {successMessage}
                    </Alert>
                    {localDraftCleanupWarning ? (
                        <Alert color="warning" role="status">
                            Radnja je spremljena na farmi, ali lokalnu skicu
                            nije moguće očistiti. Osvježi raspored prije
                            ponovnog otvaranja zadatka.
                        </Alert>
                    ) : null}
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
                    <Typography>
                        Jeste li sigurni da želite označiti operaciju kao
                        završenu: <strong>{label}</strong>?
                    </Typography>
                    {localDraft.gate.kind === 'checking' ? (
                        <Stack spacing={2}>
                            <Alert color="info" role="status">
                                Provjeravam postoji li lokalna skica na ovom
                                uređaju…
                            </Alert>
                            <Button
                                fullWidth
                                onClick={() => handleOpenChange(false)}
                                size="lg"
                                type="button"
                                variant="outlined"
                            >
                                Zatvori
                            </Button>
                        </Stack>
                    ) : null}
                    {localDraft.gate.kind === 'session_changed' ? (
                        <Alert
                            color="warning"
                            data-operation-draft-gate
                            role="alert"
                        >
                            <Stack spacing={3}>
                                <div
                                    data-operation-draft-session-focus
                                    ref={sessionChangedFocusRef}
                                    tabIndex={-1}
                                >
                                    <Typography level="body2" semiBold>
                                        Sesija je završila
                                    </Typography>
                                    <Typography level="body2">
                                        Ovaj unos nije spremljen i neće ostati
                                        na ovom uređaju. Ponovno se prijavi
                                        prije nastavka.
                                    </Typography>
                                </div>
                                <Button
                                    fullWidth
                                    onClick={() => handleOpenChange(false)}
                                    size="lg"
                                    type="button"
                                    variant="outlined"
                                >
                                    Zatvori
                                </Button>
                            </Stack>
                        </Alert>
                    ) : null}
                    {localDraft.gate.kind === 'found' ? (
                        <Alert color="info" data-operation-draft-gate>
                            <Stack spacing={3}>
                                <div>
                                    <Typography level="body2" semiBold>
                                        Pronađena lokalna skica
                                    </Typography>
                                    <Typography level="body2">
                                        Skica je spremljena samo na ovom
                                        uređaju. Radnja još nije dovršena.
                                    </Typography>
                                </div>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                    <Button
                                        disabled={isResolvingLocalDraft}
                                        fullWidth
                                        onClick={resumeLocalDraft}
                                        size="lg"
                                        type="button"
                                        variant="solid"
                                    >
                                        Nastavi uređivanje
                                    </Button>
                                    <Button
                                        color="danger"
                                        disabled={isResolvingLocalDraft}
                                        fullWidth
                                        loading={isResolvingLocalDraft}
                                        onClick={() => void discardLocalDraft()}
                                        size="lg"
                                        type="button"
                                        variant="outlined"
                                    >
                                        Odbaci skicu
                                    </Button>
                                    <Button
                                        disabled={isResolvingLocalDraft}
                                        fullWidth
                                        onClick={() => handleOpenChange(false)}
                                        size="lg"
                                        type="button"
                                        variant="plain"
                                    >
                                        Zatvori
                                    </Button>
                                </div>
                                {localDraft.saveState.kind === 'error' ? (
                                    <Typography
                                        aria-live="assertive"
                                        className="text-red-800 dark:text-red-200"
                                        data-operation-draft-gate-error
                                        level="body2"
                                    >
                                        {localDraft.saveState.reason ===
                                        'draft_changed'
                                            ? 'Skica se promijenila u drugom prozoru. Pregledaj trenutnu skicu prije odbacivanja.'
                                            : 'Lokalnu skicu trenutačno nije moguće odbaciti. Zatvori prozor i pokušaj ponovno.'}
                                    </Typography>
                                ) : null}
                            </Stack>
                        </Alert>
                    ) : null}
                    {localDraft.gate.kind === 'stale' ? (
                        <Alert color="warning" data-operation-draft-gate>
                            <Stack spacing={3}>
                                <div>
                                    <Typography level="body2" semiBold>
                                        Zadatak se promijenio
                                    </Typography>
                                    <Typography level="body2">
                                        Spremljena skica pripada staroj verziji
                                        zadatka i ne može se koristiti. Odbaci
                                        je prije nastavka.
                                    </Typography>
                                </div>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <Button
                                        color="danger"
                                        disabled={isResolvingLocalDraft}
                                        fullWidth
                                        loading={isResolvingLocalDraft}
                                        onClick={() => void discardLocalDraft()}
                                        size="lg"
                                        type="button"
                                        variant="outlined"
                                    >
                                        Odbaci skicu
                                    </Button>
                                    <Button
                                        disabled={isResolvingLocalDraft}
                                        fullWidth
                                        onClick={() => handleOpenChange(false)}
                                        size="lg"
                                        type="button"
                                        variant="plain"
                                    >
                                        Zatvori
                                    </Button>
                                </div>
                                {localDraft.saveState.kind === 'error' ? (
                                    <Typography
                                        aria-live="assertive"
                                        className="text-red-800 dark:text-red-200"
                                        data-operation-draft-gate-error
                                        level="body2"
                                    >
                                        {localDraft.saveState.reason ===
                                        'draft_changed'
                                            ? 'Skica se promijenila u drugom prozoru. Pregledaj trenutnu skicu prije odbacivanja.'
                                            : 'Lokalnu skicu trenutačno nije moguće odbaciti. Zatvori prozor i pokušaj ponovno.'}
                                    </Typography>
                                ) : null}
                            </Stack>
                        </Alert>
                    ) : null}
                    {localDraft.notice === 'expired' ? (
                        <Alert color="warning" role="status">
                            Lokalna skica istekla je nakon 7 dana i uklonjena
                            je. Možeš započeti novu skicu.
                        </Alert>
                    ) : null}
                    {localDraft.notice === 'storage_unavailable' ? (
                        <Alert color="warning" role="status">
                            Lokalna skica se ne može spremiti na ovom uređaju.
                            Unos ostaje otvoren, ali možda neće preživjeti
                            osvježavanje.
                        </Alert>
                    ) : null}
                    {!localDraftBlocksEditing && attachImages && (
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
                                data-operation-draft-focus-target={operationId}
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
                                                            Fotografija{' '}
                                                            {ordinal}
                                                        </Typography>
                                                        <Typography
                                                            level="body2"
                                                            className="truncate"
                                                            title={
                                                                uploadItem.file
                                                                    .name
                                                            }
                                                        >
                                                            {
                                                                uploadItem.file
                                                                    .name
                                                            }
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
                                                <div
                                                    aria-label={`Učitavanje fotografije ${ordinal}`}
                                                    aria-valuemax={100}
                                                    aria-valuemin={0}
                                                    aria-valuenow={progress}
                                                    className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                                                    role="progressbar"
                                                >
                                                    <div
                                                        className={`h-full transition-[width] duration-200 ${getUploadItemProgressClassName(uploadItem)}`}
                                                        style={{
                                                            width: `${progress}%`,
                                                        }}
                                                    />
                                                </div>
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
                    {!localDraftBlocksEditing && attachNotes && (
                        <Stack spacing={2}>
                            {notesRequirementText && (
                                <label
                                    className="text-sm italic"
                                    htmlFor={notesInputId}
                                >
                                    {notesRequirementText}
                                </label>
                            )}
                            <textarea
                                ref={notesInputRef}
                                aria-describedby={notesCounterId}
                                aria-invalid={notesRequiredMissing || undefined}
                                id={notesInputId}
                                value={notes}
                                onChange={(event) => {
                                    setNotes(event.target.value);
                                    clearRetryableError();
                                }}
                                placeholder="Upišite napomenu o završetku..."
                                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-base focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                rows={3}
                                maxLength={MAX_COMPLETION_NOTES_LENGTH}
                                disabled={isSubmitting}
                                required={attachNotesRequired}
                            />
                            <Typography
                                id={notesCounterId}
                                level="body2"
                                className="text-xs text-muted-foreground"
                            >
                                {notes.length}/{MAX_COMPLETION_NOTES_LENGTH}
                            </Typography>
                        </Stack>
                    )}
                    {!localDraftBlocksEditing && errorMessage && (
                        <div
                            data-schedule-submission-error
                            ref={errorRef}
                            tabIndex={-1}
                        >
                            <Alert color="danger" role="alert">
                                {errorMessage}
                            </Alert>
                        </div>
                    )}
                    {!localDraftBlocksEditing ? (
                        <>
                            {localDraft.saveState.kind === 'error' ? (
                                <Alert color="warning" role="status">
                                    {getLocalDraftSaveErrorMessage(
                                        localDraft.saveState.reason,
                                    )}
                                </Alert>
                            ) : null}
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
                                    onClick={
                                        requiresRefresh
                                            ? refreshTasks
                                            : handleConfirm
                                    }
                                    disabled={
                                        isSubmitting ||
                                        (attachImagesRequired &&
                                            uploadItems.length === 0) ||
                                        notesRequiredMissing
                                    }
                                    loading={isSubmitting}
                                    data-operation-draft-focus-target={
                                        operationId
                                    }
                                    size="lg"
                                >
                                    {errorMessage && requiresRefresh
                                        ? 'Osvježi zadatke'
                                        : hasFailedUploads || errorMessage
                                          ? 'Pokušaj ponovno'
                                          : 'Potvrdi'}
                                </Button>
                            </Row>
                            <Typography
                                aria-live="polite"
                                className="text-center text-muted-foreground"
                                data-operation-draft-status
                                level="body3"
                            >
                                {localDraft.saveState.kind === 'error' ||
                                localDraft.notice === 'storage_unavailable'
                                    ? 'Unos trenutačno nije spremljen na ovom uređaju. Radnja još nije dovršena.'
                                    : localDraft.saveState.kind === 'saving'
                                      ? 'Spremam lokalnu skicu…'
                                      : localDraft.saveState.kind === 'saved'
                                        ? 'Spremljeno samo na ovom uređaju — radnja još nije dovršena.'
                                        : 'Napomena i fotografije spremaju se samo na ovom uređaju. Radnja nije dovršena dok je ne potvrdiš.'}
                            </Typography>
                        </>
                    ) : null}
                </Stack>
            )}
        </Modal>
    );
}

export default CompleteOperationModal;
