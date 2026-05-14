'use client';

import { ImageGallery } from '@gredice/ui/ImageGallery';
import { FileText } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';

const THUMBNAIL_SIZE = 36;

type OperationCompletionAttachmentsProps = {
    operationId: number;
    notes?: string | null;
    imageUrls?: string[] | null;
    className?: string;
};

function getImageItems(operationId: number, imageUrls?: string[] | null) {
    return (imageUrls ?? [])
        .filter((url) => url.trim().length > 0)
        .map((url, index) => ({
            src: url,
            alt: `Slika završetka radnje ${operationId}-${index + 1}`,
        }));
}

export function OperationCompletionAttachments({
    operationId,
    notes,
    imageUrls,
    className,
}: OperationCompletionAttachmentsProps) {
    const trimmedNotes = notes?.trim();
    const images = getImageItems(operationId, imageUrls);

    if (!trimmedNotes && images.length === 0) {
        return null;
    }

    return (
        <Row
            spacing={0.5}
            className={['shrink-0 items-center', className]
                .filter(Boolean)
                .join(' ')}
        >
            {trimmedNotes && (
                <Modal
                    title="Napomena završetka"
                    trigger={
                        <IconButton
                            variant="plain"
                            title="Prikaži napomenu završetka"
                        >
                            <FileText className="size-4 shrink-0" />
                        </IconButton>
                    }
                >
                    <Stack spacing={1}>
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
                <div className="h-9 w-9 shrink-0 overflow-visible">
                    <ImageGallery
                        images={images}
                        previewWidth={THUMBNAIL_SIZE}
                        previewHeight={THUMBNAIL_SIZE}
                        previewVariant="stacked"
                    />
                </div>
            )}
        </Row>
    );
}
