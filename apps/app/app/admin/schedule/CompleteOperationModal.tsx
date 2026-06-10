'use client';

import { Button } from '@gredice/ui/Button';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useCallback, useRef, useState } from 'react';
import {
    ImageUploadManager,
    type ImageUploadManagerHandle,
    type ImageUploadManagerState,
} from '../../../components/shared/media/ImageUploadManager';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import {
    completeOperation,
    completeOperationWithImageUrls,
} from '../../(actions)/operationActions';

const MAX_COMPLETION_NOTES_LENGTH = 2000;

type CompleteOperationModalProps = {
    operationId: number;
    label: string;
    conditions?: EntityStandardized['conditions'];
    onConfirm?: (
        imageUrls: string[] | undefined,
        notes?: string,
    ) => unknown | Promise<unknown>;
};

export function CompleteOperationModal({
    operationId,
    label,
    conditions,
    onConfirm,
}: CompleteOperationModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [uploadItemCount, setUploadItemCount] = useState(0);
    const [hasFailedUploads, setHasFailedUploads] = useState(false);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const imageUploaderRef = useRef<ImageUploadManagerHandle>(null);

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

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        setErrorMessage(null);
        if (!open) {
            imageUploaderRef.current?.reset();
            setUploadItemCount(0);
            setHasFailedUploads(false);
            setNotes('');
        }
    };

    const handleUploadStateChange = useCallback(
        (state: ImageUploadManagerState) => {
            setUploadItemCount(state.count);
            setHasFailedUploads(state.hasFailedUploads);
            if (state.count > 0) {
                setErrorMessage(null);
            }
        },
        [],
    );

    const operationImageUploadPath = useCallback(
        ({
            attempt,
            file,
            itemId,
        }: {
            attempt: number;
            file: File;
            itemId: string;
        }) => {
            const extension = file.name.includes('.')
                ? file.name.slice(file.name.lastIndexOf('.'))
                : '';

            return `operations/${operationId}/${itemId}-${attempt}${extension}`;
        },
        [operationId],
    );

    const handleConfirm = async () => {
        try {
            setErrorMessage(null);
            if (notesRequiredMissing) {
                setErrorMessage('Napomena je obavezna za završetak.');
                return;
            }

            setIsSubmitting(true);
            const completionNotes = attachNotes ? trimmedNotes : undefined;
            let shouldResetModalState = false;
            if (attachImages && uploadItemCount > 0) {
                const imageUrls =
                    await imageUploaderRef.current?.uploadPendingImages();
                if (!imageUrls) {
                    setErrorMessage(
                        'Neke slike nisu učitane. Neuspjele stavke možete pokušati ponovno bez ponovnog odabira.',
                    );
                    return;
                }
                setIsOpen(false);
                if (onConfirm) {
                    await onConfirm(imageUrls, completionNotes);
                } else {
                    await completeOperationWithImageUrls(
                        operationId,
                        imageUrls,
                        completionNotes,
                    );
                }
                shouldResetModalState = true;
            } else {
                setIsOpen(false);
                if (onConfirm) {
                    await onConfirm(undefined, completionNotes);
                } else {
                    await completeOperation(
                        operationId,
                        undefined,
                        completionNotes,
                    );
                }
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
                    className="size-5 mx-2"
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
                        <ImageUploadManager
                            ref={imageUploaderRef}
                            disabled={isSubmitting}
                            handleUploadUrl="/api/operations/images/upload"
                            clientPayload={JSON.stringify({ operationId })}
                            uploadPath={operationImageUploadPath}
                            onStateChange={handleUploadStateChange}
                        />
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
                <Row spacing={2} justifyContent="end">
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
                            (attachImagesRequired && uploadItemCount === 0) ||
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
