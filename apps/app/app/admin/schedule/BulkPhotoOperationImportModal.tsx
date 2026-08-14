'use client';

import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Camera } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
    ImageUploadManager,
    type ImageUploadManagerHandle,
    type ImageUploadManagerState,
    type ImageUploadSelectionItem,
} from '../../../components/shared/media/ImageUploadManager';
import { completeOperationsWithImageUrls } from '../../(actions)/operationActions';
import {
    type BulkPhotoOperationTarget,
    buildBulkPhotoImportPreview,
} from './bulkPhotoOperationImportModel';

type BulkPhotoOperationImportModalProps = {
    targets: BulkPhotoOperationTarget[];
};

function fileExtension(fileName: string) {
    const extensionIndex = fileName.lastIndexOf('.');
    return extensionIndex > 0 ? fileName.slice(extensionIndex) : '';
}

function croatianCountForm(
    count: number,
    singular: string,
    paucal: string,
    plural: string,
) {
    const lastTwoDigits = count % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
        return plural;
    }

    const lastDigit = count % 10;
    if (lastDigit === 1) {
        return singular;
    }
    if (lastDigit >= 2 && lastDigit <= 4) {
        return paucal;
    }

    return plural;
}

function selectedImagesLabel(count: number) {
    return `Odabrano ${count} ${croatianCountForm(
        count,
        'slika',
        'slike',
        'slika',
    )}`;
}

export function BulkPhotoOperationImportModal({
    targets,
}: BulkPhotoOperationImportModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasFailedUploads, setHasFailedUploads] = useState(false);
    const [hasCompletionFailures, setHasCompletionFailures] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [sessionTargets, setSessionTargets] = useState(targets);
    const [selectedItems, setSelectedItems] = useState<
        ImageUploadSelectionItem[]
    >([]);
    const imageUploaderRef = useRef<ImageUploadManagerHandle>(null);

    const preview = useMemo(
        () =>
            buildBulkPhotoImportPreview(
                selectedItems.map((item) => ({
                    id: item.id,
                    fileName: item.file.name,
                })),
                sessionTargets,
            ),
        [selectedItems, sessionTargets],
    );
    const assignmentByItemId = useMemo(
        () =>
            new Map(
                preview.assignments.map((assignment) => [
                    assignment.itemId,
                    assignment,
                ]),
            ),
        [preview.assignments],
    );

    const reset = useCallback(() => {
        imageUploaderRef.current?.reset();
        setSelectedItems([]);
        setHasFailedUploads(false);
        setHasCompletionFailures(false);
        setErrorMessage(null);
    }, []);

    const handleOpenChange = (open: boolean) => {
        if (!open && isSubmitting) {
            return;
        }

        setIsOpen(open);
        if (open) {
            setSessionTargets(targets);
            setErrorMessage(null);
        } else {
            reset();
        }
    };

    const handleUploadStateChange = useCallback(
        (state: ImageUploadManagerState) => {
            setHasFailedUploads(state.hasFailedUploads);
        },
        [],
    );

    const handleSelectionChange = useCallback(
        (items: ImageUploadSelectionItem[]) => {
            setSelectedItems(items);
            setErrorMessage(null);
            setHasCompletionFailures(false);
        },
        [],
    );

    const clientPayload = useCallback(
        ({ itemId }: { itemId: string }) => {
            const assignment = assignmentByItemId.get(itemId);
            return assignment
                ? JSON.stringify({
                      operationId: assignment.target.operationId,
                  })
                : undefined;
        },
        [assignmentByItemId],
    );

    const uploadPath = useCallback(
        ({
            attempt,
            file,
            itemId,
        }: {
            attempt: number;
            file: File;
            itemId: string;
        }) => {
            const assignment = assignmentByItemId.get(itemId);
            const operationId = assignment?.target.operationId ?? 0;

            return `operations/${operationId}/bulk-${itemId}-${attempt}${fileExtension(file.name)}`;
        },
        [assignmentByItemId],
    );
    const uploadItemLabel = useCallback(
        ({ id }: ImageUploadSelectionItem) => {
            const assignment = assignmentByItemId.get(id);
            return assignment
                ? `Gr ${assignment.target.physicalId}`
                : undefined;
        },
        [assignmentByItemId],
    );

    const handleConfirm = async () => {
        if (!preview.canSubmit || isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);
        try {
            const imageUrls =
                await imageUploaderRef.current?.uploadPendingImages();
            if (!imageUrls || imageUrls.length !== selectedItems.length) {
                setErrorMessage(
                    'Neke slike nisu učitane. Neuspjele stavke možete pokušati ponovno bez ponovnog odabira.',
                );
                return;
            }

            const imageUrlByItemId = new Map(
                selectedItems.map((item, index) => [
                    item.id,
                    imageUrls[index] ?? '',
                ]),
            );
            const completionResult = await completeOperationsWithImageUrls(
                preview.groups.map((group) => ({
                    operationId: group.target.operationId,
                    expectedEntityId: group.target.expectedEntityId,
                    expectedTaskVersionEventId:
                        group.target.expectedTaskVersionEventId,
                    imageUrls: group.assignments
                        .map((assignment) =>
                            imageUrlByItemId.get(assignment.itemId),
                        )
                        .filter((imageUrl): imageUrl is string =>
                            Boolean(imageUrl),
                        ),
                })),
            );
            if (!completionResult.success) {
                setHasCompletionFailures(true);
                setErrorMessage(
                    completionResult.completedCount > 0
                        ? `${completionResult.completedCount} od ${preview.groups.length} radnji je spremljeno. Pokušajte ponovno za preostale radnje.`
                        : 'Završetak radnji nije uspio. Pokušajte ponovno bez ponovnog odabira slika.',
                );
                return;
            }

            setIsOpen(false);
            reset();
        } catch (error) {
            console.error('Bulk photo operation import failed:', error);
            setHasCompletionFailures(true);
            setErrorMessage(
                'Skupno učitavanje nije uspjelo. Pokušajte ponovno bez ponovnog odabira slika.',
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const groupIssueCount = preview.groups.filter(
        (group) => group.errorMessage,
    ).length;
    const hasPreviewErrors = preview.errors.length > 0 || groupIssueCount > 0;
    const completionButtonLabel =
        preview.groups.length === 0
            ? 'Odaberite fotografije'
            : `Učitaj i završi ${preview.groups.length} ${croatianCountForm(
                  preview.groups.length,
                  'radnju',
                  'radnje',
                  'radnji',
              )}`;

    return (
        <Modal
            title="Skupni unos fotografija gredica"
            description="Povežite odabrane fotografije sa zakazanim radnjama prema fizičkom ID-u gredice."
            open={isOpen}
            onOpenChange={handleOpenChange}
            dismissible={!isSubmitting}
            className="max-w-5xl"
            trigger={
                <IconButton
                    variant="plain"
                    size="xs"
                    title="Skupno učitaj fotografije gredica"
                    aria-label="Skupno učitaj fotografije gredica"
                    disabled={targets.length === 0}
                >
                    <Camera className="size-4 shrink-0" />
                </IconButton>
            }
        >
            <Stack spacing={4}>
                <Typography level="body2" className="text-muted-foreground">
                    Odaberite slike nazvane <code>Gr&lt;fizički ID&gt;</code>.
                    Za više slika iste gredice dodajte nastavke poput{' '}
                    <code>- 1</code>, <code>- 2</code>. Fotografije će se
                    učitati i povezane radnje „Fotografiranje gredice” označiti
                    završenima.
                </Typography>

                <ImageUploadManager
                    ref={imageUploaderRef}
                    disabled={isSubmitting}
                    handleUploadUrl="/api/operations/images/upload"
                    clientPayload={clientPayload}
                    uploadPath={uploadPath}
                    uploadConcurrency={4}
                    layout="grid"
                    itemLabel={uploadItemLabel}
                    onSelectionChange={handleSelectionChange}
                    onStateChange={handleUploadStateChange}
                    showCameraButton={false}
                    addLabel="Odaberi fotografije"
                    addMoreLabel="Dodaj još fotografija"
                    emptyLabel="Odaberite sve fotografije koje želite povezati sa zakazanim radnjama."
                    pasteHint="Nazivi se provjeravaju prije učitavanja; razmaci oko prefiksa i nastavka nisu važni."
                    selectedLabel={selectedImagesLabel}
                />

                {groupIssueCount > 0 && (
                    <Stack spacing={2}>
                        <Typography level="h6" className="text-red-600">
                            Gredice s previše fotografija
                        </Typography>
                        {preview.groups.map(
                            (group) =>
                                group.errorMessage && (
                                    <Typography
                                        key={group.target.operationId}
                                        level="body2"
                                        className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                                    >
                                        Gr {group.target.physicalId}:{' '}
                                        {group.errorMessage}
                                    </Typography>
                                ),
                        )}
                    </Stack>
                )}

                {preview.errors.length > 0 && (
                    <Stack spacing={2}>
                        <Typography level="h6" className="text-red-600">
                            Datoteke koje treba preimenovati
                        </Typography>
                        {preview.errors.map((error) => (
                            <div
                                key={error.itemId}
                                className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30"
                            >
                                <Typography
                                    level="body2"
                                    className="font-medium"
                                >
                                    {error.fileName}
                                </Typography>
                                <Typography
                                    level="body3"
                                    className="text-red-700 dark:text-red-300"
                                >
                                    {error.message}
                                </Typography>
                            </div>
                        ))}
                    </Stack>
                )}

                {preview.batchErrorMessage && (
                    <Typography level="body2" className="text-red-600">
                        {preview.batchErrorMessage}
                    </Typography>
                )}

                {isSubmitting && (
                    <Typography level="body2">
                        Učitavanje fotografija i završavanje radnji je u
                        tijeku...
                    </Typography>
                )}
                {errorMessage && (
                    <Typography level="body2" className="text-red-600">
                        {errorMessage}
                    </Typography>
                )}
                <Row spacing={2} justifyContent="end" className="flex-wrap">
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
                            !preview.canSubmit ||
                            hasPreviewErrors
                        }
                        loading={isSubmitting}
                    >
                        {hasFailedUploads || hasCompletionFailures
                            ? 'Pokušaj ponovno'
                            : completionButtonLabel}
                    </Button>
                </Row>
            </Stack>
        </Modal>
    );
}
