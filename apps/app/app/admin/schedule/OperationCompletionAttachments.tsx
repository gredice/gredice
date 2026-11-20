'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { ImageGallery } from '@gredice/ui/ImageGallery';
import { Edit, FileText } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { OperationCompletionEvidenceEditModal } from './OperationCompletionEvidenceEditModal';
import { isOperationPendingVerification } from './scheduleShared';
import type { Operation } from './types';

const THUMBNAIL_SIZE = 56;

type OperationCompletionAttachmentsProps = {
    operationId: number;
    notes?: string | null;
    imageUrls?: string[] | null;
    onEditImage?: (src: string) => void;
};

function getImageItems(operationId: number, imageUrls?: string[] | null) {
    return (imageUrls ?? [])
        .filter((url) => url.trim().length > 0)
        .map((url, index) => ({
            src: url,
            alt: `Slika završetka radnje ${operationId}-${index + 1}`,
        }));
}

function AttachmentPreviews({
    operationId,
    notes,
    imageUrls,
    onEditImage,
}: OperationCompletionAttachmentsProps) {
    const trimmedNotes = notes?.trim();
    const images = getImageItems(operationId, imageUrls);

    if (!trimmedNotes && images.length === 0) {
        return null;
    }

    return (
        <Row spacing={1} className="shrink-0 items-center">
            {trimmedNotes && (
                <Modal
                    title="Napomena završetka"
                    trigger={
                        <IconButton
                            variant="plain"
                            size="xs"
                            title="Prikaži napomenu završetka"
                        >
                            <FileText className="size-4 shrink-0" />
                        </IconButton>
                    }
                >
                    <Stack spacing={2}>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Radnja #{operationId}
                        </Typography>
                        <Typography className="whitespace-pre-wrap">
                            {trimmedNotes}
                        </Typography>
                    </Stack>
                </Modal>
            )}
            {images.length > 0 && (
                <div className="size-14 shrink-0 overflow-visible">
                    <ImageGallery
                        images={images}
                        onEditImage={onEditImage}
                        previewWidth={THUMBNAIL_SIZE}
                        previewHeight={THUMBNAIL_SIZE}
                        previewVariant="stacked"
                    />
                </div>
            )}
        </Row>
    );
}

export function OperationCompletionAttachments({
    operation,
    label,
}: {
    operation: Pick<
        Operation,
        | 'id'
        | 'status'
        | 'taskVersionEventId'
        | 'completionNotes'
        | 'completionNotesEdited'
        | 'imageUrls'
    >;
    label: string;
}) {
    const canEditImages = isOperationPendingVerification(operation.status);
    return (
        <OperationCompletionEvidenceEditModal
            operationId={operation.id}
            expectedTaskVersionEventId={operation.taskVersionEventId}
            label={label}
            initialNotes={operation.completionNotes}
            completionNotesEdited={operation.completionNotesEdited}
            initialImageUrls={operation.imageUrls}
            notesOnly={!canEditImages}
            renderTrigger={({ openModal, editImage }) => (
                <>
                    <AttachmentPreviews
                        operationId={operation.id}
                        notes={operation.completionNotes}
                        imageUrls={operation.imageUrls}
                        onEditImage={canEditImages ? editImage : undefined}
                    />
                    <IconButton
                        title={
                            canEditImages
                                ? 'Uredi zapis završetka'
                                : 'Uredi napomenu završetka'
                        }
                        type="button"
                        size="xs"
                        variant="plain"
                        onClick={openModal}
                    >
                        <Edit className="size-4 shrink-0" />
                    </IconButton>
                </>
            )}
        />
    );
}
