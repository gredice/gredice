'use client';

import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Clear, Edit } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
    Fragment,
    type ReactElement,
    useCallback,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    ImageUploadManager,
    type ImageUploadManagerHandle,
    type ImageUploadManagerState,
} from '../../../components/shared/media/ImageUploadManager';
import { updateOperationCompletionEvidenceAction } from '../../(actions)/operationActions';
import { buildOperationCompletionEvidenceActionArguments } from './operationCompletionEvidenceEditModel';

const MAX_COMPLETION_IMAGE_COUNT = 20;
const MAX_COMPLETION_NOTES_LENGTH = 2000;

type EditOperationCompletionEvidenceTriggerProps = {
    isSubmitting: boolean;
    openModal: () => void;
    defaultTrigger: ReactElement;
};

type EditOperationCompletionEvidenceModalBaseProps = {
    operationId: number;
    expectedTaskVersionEventId: number;
    label: string;
    initialNotes?: string | null;
    initialImageUrls?: string[] | null;
};

type EditOperationCompletionEvidenceModalProps =
    EditOperationCompletionEvidenceModalBaseProps &
        (
            | {
                  trigger?: ReactElement;
                  renderTrigger?: never;
              }
            | {
                  trigger?: never;
                  renderTrigger: (
                      props: EditOperationCompletionEvidenceTriggerProps,
                  ) => ReactElement;
              }
        );

function normalizeImageUrls(imageUrls?: string[] | null) {
    return Array.from(
        new Set(
            (imageUrls ?? [])
                .map((imageUrl) => imageUrl.trim())
                .filter(Boolean),
        ),
    );
}

export function OperationCompletionEvidenceEditModal({
    operationId,
    expectedTaskVersionEventId,
    label,
    initialNotes,
    initialImageUrls,
    trigger,
    renderTrigger,
}: EditOperationCompletionEvidenceModalProps) {
    const router = useRouter();
    const initialUrls = useMemo(
        () => normalizeImageUrls(initialImageUrls),
        [initialImageUrls],
    );
    const [open, setOpen] = useState(false);
    const [notes, setNotes] = useState(initialNotes ?? '');
    const [imageUrls, setImageUrls] = useState(initialUrls);
    const [uploadItemCount, setUploadItemCount] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const imageUploaderRef = useRef<ImageUploadManagerHandle>(null);

    const resetForm = useCallback(() => {
        setNotes(initialNotes ?? '');
        setImageUrls(initialUrls);
        setUploadItemCount(0);
        setErrorMessage(null);
        imageUploaderRef.current?.reset();
    }, [initialNotes, initialUrls]);

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (nextOpen) {
            resetForm();
        } else if (!isSubmitting) {
            resetForm();
        }
    };

    const handleUploadStateChange = useCallback(
        (state: ImageUploadManagerState) => {
            setUploadItemCount(state.count);
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

    const removeImageUrl = (imageUrlToRemove: string) => {
        setImageUrls((currentImageUrls) =>
            currentImageUrls.filter(
                (imageUrl) => imageUrl !== imageUrlToRemove,
            ),
        );
        setErrorMessage(null);
    };

    const handleSave = async () => {
        try {
            setErrorMessage(null);
            const trimmedNotes = notes.trim();
            if (trimmedNotes.length > MAX_COMPLETION_NOTES_LENGTH) {
                setErrorMessage(
                    `Napomena može imati najviše ${MAX_COMPLETION_NOTES_LENGTH} znakova.`,
                );
                return;
            }

            setIsSubmitting(true);
            const uploadedImageUrls =
                uploadItemCount > 0
                    ? await imageUploaderRef.current?.uploadPendingImages()
                    : [];
            if (!uploadedImageUrls) {
                setErrorMessage(
                    'Neke slike nisu učitane. Neuspjele stavke možete pokušati ponovno bez ponovnog odabira.',
                );
                return;
            }

            const nextImageUrls = normalizeImageUrls([
                ...imageUrls,
                ...uploadedImageUrls,
            ]);
            if (nextImageUrls.length > MAX_COMPLETION_IMAGE_COUNT) {
                setErrorMessage(
                    `Zapis završetka može imati najviše ${MAX_COMPLETION_IMAGE_COUNT} slika.`,
                );
                return;
            }

            await updateOperationCompletionEvidenceAction(
                ...buildOperationCompletionEvidenceActionArguments({
                    operationId,
                    expectedTaskVersionEventId,
                    imageUrls: nextImageUrls,
                    notes: trimmedNotes,
                }),
            );
            setOpen(false);
            resetForm();
            router.refresh();
        } catch (error) {
            console.error(
                'Error updating operation completion evidence:',
                error,
            );
            setErrorMessage(
                'Spremanje izmjena nije uspjelo. Pokušajte ponovno.',
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const remainingImageSlots = Math.max(
        0,
        MAX_COMPLETION_IMAGE_COUNT - imageUrls.length,
    );
    const defaultTrigger = (
        <Button
            variant="outlined"
            size="xs"
            title="Uredi zapis završetka"
            startDecorator={<Edit className="size-3.5" />}
            loading={isSubmitting}
        >
            Uredi zapis
        </Button>
    );

    return (
        <Fragment>
            {renderTrigger?.({
                isSubmitting,
                openModal: () => handleOpenChange(true),
                defaultTrigger,
            })}
            <Modal
                title="Uređivanje zapisa završetka"
                open={open}
                onOpenChange={handleOpenChange}
                trigger={
                    renderTrigger ? undefined : (trigger ?? defaultTrigger)
                }
                className="max-w-2xl"
            >
                <Stack spacing={4}>
                    <Stack spacing={1}>
                        <Typography level="h5">
                            Uredi zapis završetka
                        </Typography>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            {label}
                        </Typography>
                    </Stack>
                    <Stack spacing={2}>
                        <label
                            htmlFor={`operation-${operationId}-completion-notes`}
                            className="text-sm font-medium"
                        >
                            Napomena
                        </label>
                        <textarea
                            id={`operation-${operationId}-completion-notes`}
                            value={notes}
                            onChange={(event) => {
                                setNotes(event.target.value);
                                setErrorMessage(null);
                            }}
                            disabled={isSubmitting}
                            rows={5}
                            maxLength={MAX_COMPLETION_NOTES_LENGTH}
                            className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-hidden focus:border-primary focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            {notes.trim().length}/{MAX_COMPLETION_NOTES_LENGTH}
                        </Typography>
                    </Stack>
                    <Stack spacing={2}>
                        <Typography level="body2" semiBold>
                            Slike
                        </Typography>
                        {imageUrls.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {imageUrls.map((imageUrl, index) => (
                                    <div
                                        key={imageUrl}
                                        className="relative overflow-hidden rounded-md border bg-muted"
                                    >
                                        <Image
                                            src={imageUrl}
                                            alt={`Slika završetka radnje ${operationId}-${index + 1}`}
                                            width={240}
                                            height={180}
                                            className="aspect-[4/3] w-full object-cover"
                                        />
                                        <IconButton
                                            aria-label={`Ukloni sliku ${index + 1}`}
                                            type="button"
                                            size="xs"
                                            variant="solid"
                                            color="danger"
                                            className="absolute right-2 top-2"
                                            disabled={isSubmitting}
                                            onClick={() =>
                                                removeImageUrl(imageUrl)
                                            }
                                        >
                                            <Clear className="size-3.5" />
                                        </IconButton>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <Typography
                                level="body2"
                                className="rounded-md border border-dashed border-input bg-muted/20 px-3 py-4 text-muted-foreground"
                            >
                                Nema slika u zapisu završetka.
                            </Typography>
                        )}
                        {remainingImageSlots > 0 ? (
                            <ImageUploadManager
                                ref={imageUploaderRef}
                                disabled={isSubmitting}
                                handleUploadUrl="/api/operations/images/upload"
                                clientPayload={JSON.stringify({ operationId })}
                                maxItems={remainingImageSlots}
                                uploadPath={operationImageUploadPath}
                                addLabel="Dodaj nove slike"
                                addMoreLabel="Dodaj još novih slika"
                                emptyLabel="Dodajte slike koje će se spremiti u zapis završetka."
                                onStateChange={handleUploadStateChange}
                            />
                        ) : (
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Dosegnut je najveći broj slika.
                            </Typography>
                        )}
                    </Stack>
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
                            onClick={handleSave}
                            loading={isSubmitting}
                            disabled={isSubmitting}
                        >
                            Spremi izmjene
                        </Button>
                    </Row>
                </Stack>
            </Modal>
        </Fragment>
    );
}

export default OperationCompletionEvidenceEditModal;
