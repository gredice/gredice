import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { ImageGallery } from '@gredice/ui/ImageGallery';
import { Camera, Navigate } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { NoDataPlaceholder } from '@gredice/ui/NoDataPlaceholder';
import { Row } from '@gredice/ui/Row';
import { Spinner } from '@gredice/ui/Spinner';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useMemo } from 'react';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useGardenOperations } from '../../hooks/useGardenOperations';
import { useOperations } from '../../hooks/useOperations';
import { useRaisedBedAiHistory } from '../../hooks/useRaisedBedAiHistory';
import { ButtonGreen } from '../../shared-ui/ButtonGreen';
import { sortNewestFirst } from '../GardenOperationsHud';
import { RaisedBedDiaryAiAction } from './RaisedBedDiaryAiAction';
import {
    buildFieldPositionById,
    getAiHistoryForOperation,
    getOperationReferenceDate,
} from './raisedBedOperationHistory';

const PHOTO_PAGE_SIZE = 20;

type RaisedBedPhotosModalProps = {
    gardenId: number;
    raisedBedId: number;
    subjectName: string;
    positionIndex?: number;
    triggerPlacement?: 'hud' | 'header';
    hideWhenEmpty?: boolean;
    className?: string;
};

function getDateLabel(value: string | Date | null | undefined) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toLocaleDateString('hr-HR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function getPhotoCountLabel(photoCount: number) {
    if (photoCount === 1) {
        return '1 fotografija';
    }

    if (photoCount > 1 && photoCount < 5) {
        return `${photoCount} fotografije`;
    }

    return `${photoCount} fotografija`;
}

export function RaisedBedPhotosModal({
    gardenId,
    raisedBedId,
    subjectName,
    positionIndex,
    triggerPlacement = 'header',
    hideWhenEmpty = false,
    className,
}: RaisedBedPhotosModalProps) {
    const { data: currentGarden } = useCurrentGarden();
    const { data: operationsData } = useOperations();
    const history = useGardenOperations({
        includeCompleted: true,
        pageSize: PHOTO_PAGE_SIZE,
        raisedBedId,
        positionIndex,
    });
    const { data: aiHistoryEntries } = useRaisedBedAiHistory(
        gardenId,
        raisedBedId,
        { enabled: Boolean(gardenId && raisedBedId) },
    );
    const fieldPositionById = useMemo(
        () => buildFieldPositionById(currentGarden),
        [currentGarden],
    );
    const operationDataById = useMemo(
        () =>
            new Map(
                (operationsData ?? []).map((operation) => [
                    operation.id,
                    operation,
                ]),
            ),
        [operationsData],
    );
    const photoOperations = useMemo(
        () =>
            sortNewestFirst(
                history.data?.pages
                    .flatMap((page) => page.items)
                    .filter((operation) => operation.imageUrls.length > 0) ??
                    [],
            ),
        [history.data?.pages],
    );
    const photoCount = photoOperations.reduce(
        (count, operation) => count + operation.imageUrls.length,
        0,
    );
    const latestImageUrls = Array.from(
        new Set(photoOperations.flatMap((operation) => operation.imageUrls)),
    ).slice(0, 3);
    const isFieldScoped = typeof positionIndex === 'number';
    const triggerLabel = isFieldScoped
        ? `Fotografije biljke ${subjectName}`
        : `Fotografije gredice ${subjectName}`;
    const modalTitle = isFieldScoped
        ? 'Fotografije biljke'
        : 'Fotografije gredice';

    if (hideWhenEmpty && (history.isError || photoCount === 0)) {
        return null;
    }

    const thumbnail = (
        <span className="relative flex size-full items-center justify-center overflow-hidden rounded-[inherit] bg-card">
            {latestImageUrls.length > 0 ? (
                latestImageUrls.map((imageUrl, index) => (
                    <span
                        key={imageUrl}
                        className="absolute overflow-hidden rounded-[inherit] border border-white/80 bg-muted shadow-sm"
                        style={{
                            inset: index === 0 ? 0 : `${index * 4}px`,
                            zIndex: latestImageUrls.length - index,
                            transform:
                                index === 0
                                    ? undefined
                                    : `translate(${index * 4}px, ${index * -3}px) rotate(${index * 4}deg)`,
                        }}
                    >
                        {/** biome-ignore lint/performance/noImgElement: Operation photos come from runtime data and can use external blob hosts. */}
                        <img
                            src={imageUrl}
                            alt=""
                            className="size-full object-cover"
                            loading="lazy"
                        />
                    </span>
                ))
            ) : (
                <Camera className="size-5 text-muted-foreground" />
            )}
        </span>
    );

    const photoCountBadge =
        photoCount > 0 ? (
            <span className="absolute -bottom-1 -right-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground shadow-sm">
                {photoCount}
            </span>
        ) : null;
    const trigger =
        triggerPlacement === 'hud' ? (
            <ButtonGreen
                variant="plain"
                className={cx(
                    'h-12 w-24 rounded-2xl p-1 shadow-lg ring-1 ring-black/10',
                    className,
                )}
                aria-label={triggerLabel}
                title={triggerLabel}
            >
                <span className="relative flex h-full w-full items-center justify-start">
                    <span className="relative size-10 shrink-0 rounded-xl">
                        {thumbnail}
                        {photoCountBadge}
                    </span>
                    <span className="ml-2 flex min-w-0 flex-col items-start">
                        <span className="text-xs font-semibold leading-tight">
                            Foto
                        </span>
                        <span className="text-[11px] leading-tight text-primary/70">
                            {photoCount > 0 ? photoCount : '...'}
                        </span>
                    </span>
                </span>
            </ButtonGreen>
        ) : (
            <button
                type="button"
                className={cx(
                    'relative inline-flex size-14 shrink-0 items-center justify-center rounded-2xl border bg-card p-1 shadow-xs transition hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2',
                    className,
                )}
                aria-label={triggerLabel}
                title={triggerLabel}
            >
                {thumbnail}
                {photoCountBadge}
            </button>
        );

    return (
        <Modal
            title={modalTitle}
            className="overflow-x-hidden md:max-w-5xl md:border-tertiary md:border-b-4"
            trigger={trigger}
        >
            <Stack
                spacing={4}
                className="min-w-0 max-w-full"
                data-raised-bed-photos-modal
            >
                <Row
                    spacing={4}
                    className="min-w-0 flex-wrap items-start justify-between gap-y-2"
                >
                    <Stack spacing={1} className="min-w-0">
                        <Typography level="h4" component="h1">
                            {modalTitle}
                        </Typography>
                        <Typography level="body2" secondary>
                            {subjectName}
                        </Typography>
                    </Stack>
                    {photoCount > 0 && (
                        <Chip variant="soft">
                            {getPhotoCountLabel(photoCount)}
                        </Chip>
                    )}
                </Row>
                {history.isError && (
                    <Alert color="danger">
                        Došlo je do pogreške prilikom učitavanja fotografija.
                    </Alert>
                )}
                {history.isLoading && (
                    <Spinner
                        loading
                        loadingLabel="Učitavanje fotografija..."
                        className="mx-auto my-8 flex items-center justify-center"
                    />
                )}
                {!history.isLoading && !history.isError && photoCount === 0 && (
                    <NoDataPlaceholder className="p-4">
                        Nema zabilježenih fotografija.
                    </NoDataPlaceholder>
                )}
                {photoOperations.map((operation) => {
                    const operationData =
                        operation.entityTypeName === 'operation'
                            ? operationDataById.get(operation.entityId)
                            : undefined;
                    const entryName =
                        operationData?.information.label ??
                        operation.targetLabel;
                    const operationPositionIndex =
                        positionIndex ??
                        (operation.raisedBedFieldId
                            ? fieldPositionById.get(operation.raisedBedFieldId)
                            : undefined);
                    const operationDateLabel = getDateLabel(
                        getOperationReferenceDate(operation),
                    );

                    return (
                        <div
                            key={`${operation.entityTypeName}-${operation.id}`}
                            className="rounded-xl border bg-card p-3 shadow-xs"
                            data-raised-bed-photo-entry
                        >
                            <Stack spacing={3}>
                                <Row
                                    spacing={2}
                                    className="min-w-0 flex-wrap items-start justify-between gap-y-2"
                                >
                                    <Stack spacing={0.5} className="min-w-0">
                                        <Typography
                                            level="body1"
                                            semiBold
                                            className="break-words"
                                        >
                                            {entryName}
                                        </Typography>
                                        <Typography level="body3" secondary>
                                            {operationDateLabel ??
                                                operation.targetLabel}
                                        </Typography>
                                    </Stack>
                                    <Chip variant="soft">
                                        {getPhotoCountLabel(
                                            operation.imageUrls.length,
                                        )}
                                    </Chip>
                                </Row>
                                <ImageGallery
                                    images={operation.imageUrls.map(
                                        (imageUrl, imageIndex) => ({
                                            src: imageUrl,
                                            alt: `${entryName} ${imageIndex + 1}`,
                                            dateLabel:
                                                operationDateLabel ?? undefined,
                                        }),
                                    )}
                                    previewAs="div"
                                    previewVariant="grid"
                                    previewWidth={240}
                                    previewLimitBeforeStack={5}
                                />
                                <Row
                                    spacing={2}
                                    className="items-center justify-between gap-y-2"
                                >
                                    <Typography level="body3" secondary>
                                        {operation.targetLabel}
                                    </Typography>
                                    <RaisedBedDiaryAiAction
                                        gardenId={gardenId}
                                        raisedBedId={raisedBedId}
                                        positionIndex={operationPositionIndex}
                                        entryName={entryName}
                                        imageUrls={operation.imageUrls}
                                        referenceDate={getOperationReferenceDate(
                                            operation,
                                        )}
                                        historyEntries={getAiHistoryForOperation(
                                            {
                                                imageUrls: operation.imageUrls,
                                                entries: aiHistoryEntries,
                                            },
                                        )}
                                    />
                                </Row>
                            </Stack>
                        </div>
                    );
                })}
                {history.hasNextPage && (
                    <Button
                        variant="plain"
                        size="sm"
                        loading={history.isFetchingNextPage}
                        onClick={() => history.fetchNextPage()}
                        endDecorator={<Navigate className="size-4" />}
                    >
                        Prikaži više
                    </Button>
                )}
            </Stack>
        </Modal>
    );
}
