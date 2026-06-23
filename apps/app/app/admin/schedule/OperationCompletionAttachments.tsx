'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { ImageGallery } from '@gredice/ui/ImageGallery';
import { FileText } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';

const THUMBNAIL_SIZE = 32;

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
            spacing={1}
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
                <div className="size-8 shrink-0 overflow-visible">
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
