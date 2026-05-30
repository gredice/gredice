import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { AiAnalysisRequestError } from '../../hooks/aiAnalysisError';
import { useRaisedBedAiAnalysis } from '../../hooks/useRaisedBedAiAnalysis';
import { useRaisedBedFieldAiAnalysis } from '../../hooks/useRaisedBedFieldAiAnalysis';
import { ButtonGreen } from '../../shared-ui/ButtonGreen';
import styles from './RaisedBedDiaryAiAction.module.css';

type RaisedBedDiaryAiActionProps = {
    gardenId: number;
    raisedBedId: number;
    entryName: string;
    imageUrls: string[];
    positionIndex?: number;
    historyEntries?: Array<{
        id: number;
        description: string | undefined;
        timestamp: Date;
        imageUrls?: string[] | null;
    }>;
};

type AnalysisPhase = 'idle' | 'thinking' | 'typing' | 'done' | 'error';

export function RaisedBedDiaryAiAction({
    gardenId,
    raisedBedId,
    entryName,
    imageUrls,
    positionIndex,
    historyEntries,
}: RaisedBedDiaryAiActionProps) {
    const [open, setOpen] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState(
        imageUrls[0] ?? '',
    );
    const [visibleMarkdown, setVisibleMarkdown] = useState('');
    const [phase, setPhase] = useState<AnalysisPhase>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [errorStatus, setErrorStatus] = useState<number | null>(null);
    const [selectedHistoryEntryId, setSelectedHistoryEntryId] = useState<
        number | null
    >(null);
    const [resultSource, setResultSource] = useState<
        'history' | 'analysis' | null
    >(null);
    const [analysisCompletedAt, setAnalysisCompletedAt] = useState<Date | null>(
        null,
    );
    const requestIdRef = useRef(0);
    const raisedBedAnalysis = useRaisedBedAiAnalysis();
    const raisedBedFieldAnalysis = useRaisedBedFieldAiAnalysis();
    const activeMutation =
        typeof positionIndex === 'number'
            ? raisedBedFieldAnalysis
            : raisedBedAnalysis;
    const latestHistoryEntry = historyEntries?.[0];
    const latestCompleteHistoryEntry = historyEntries?.find((entry) => {
        const analyzedImageUrls = entry.imageUrls ?? [];

        return imageUrls.every((imageUrl) =>
            analyzedImageUrls.includes(imageUrl),
        );
    });

    useEffect(() => {
        if (!selectedImageUrl && imageUrls[0]) {
            setSelectedImageUrl(imageUrls[0]);
        }
    }, [imageUrls, selectedImageUrl]);

    function resetPresentation() {
        requestIdRef.current += 1;
        setVisibleMarkdown('');
        setErrorMessage(null);
        setErrorStatus(null);
        setPhase('idle');
        setSelectedHistoryEntryId(null);
        setResultSource(null);
        setAnalysisCompletedAt(null);
    }

    function beginAnalysis() {
        if (!imageUrls.length) {
            return;
        }

        requestIdRef.current += 1;
        const requestId = requestIdRef.current;

        if (!selectedImageUrl) {
            setSelectedImageUrl(imageUrls[0] ?? '');
        }
        setVisibleMarkdown('');
        setErrorMessage(null);
        setErrorStatus(null);
        setPhase('thinking');
        setSelectedHistoryEntryId(null);
        setResultSource('analysis');
        setAnalysisCompletedAt(null);

        const onChunk = (accumulated: string) => {
            if (requestIdRef.current !== requestId) return;
            setPhase('typing');
            setVisibleMarkdown(accumulated);
        };

        const callbacks = {
            onSuccess: () => {
                if (requestIdRef.current !== requestId) return;
                setPhase('done');
                setAnalysisCompletedAt(new Date());
            },
            onError: (error: Error) => {
                if (requestIdRef.current !== requestId) return;
                setPhase('error');
                setErrorMessage(error.message);
                setErrorStatus(
                    error instanceof AiAnalysisRequestError
                        ? error.status
                        : null,
                );
                setAnalysisCompletedAt(null);
            },
        };

        if (typeof positionIndex === 'number') {
            raisedBedFieldAnalysis.mutate(
                {
                    gardenId,
                    raisedBedId,
                    positionIndex,
                    imageUrls,
                    onChunk,
                },
                callbacks,
            );
        } else {
            raisedBedAnalysis.mutate(
                {
                    gardenId,
                    raisedBedId,
                    imageUrls,
                    onChunk,
                },
                callbacks,
            );
        }
    }

    function handleOpen() {
        if (!imageUrls.length) {
            return;
        }

        setOpen(true);
        beginAnalysis();
    }

    function handlePrimaryAction() {
        if (latestCompleteHistoryEntry) {
            handleShowHistory(latestCompleteHistoryEntry);
            return;
        }

        handleOpen();
    }

    function handleShowHistory(
        entry = latestCompleteHistoryEntry ?? latestHistoryEntry,
    ) {
        if (!entry) {
            return;
        }

        requestIdRef.current += 1;
        setOpen(true);
        setSelectedHistoryEntryId(entry.id);
        setSelectedImageUrl(entry.imageUrls?.[0] ?? imageUrls[0] ?? '');
        setVisibleMarkdown(entry.description ?? '');
        setErrorMessage(null);
        setErrorStatus(null);
        setPhase('done');
        setResultSource('history');
        setAnalysisCompletedAt(null);
    }

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen);

        if (!nextOpen) {
            resetPresentation();
        }
    }

    const statusTitle =
        resultSource === 'history' && phase === 'done'
            ? 'Prethodni odgovor'
            : phase === 'thinking'
              ? 'Suncokret razmišlja...'
              : phase === 'typing'
                ? 'Analiza stiže...'
                : phase === 'done'
                  ? 'Analiza je spremna'
                  : phase === 'error'
                    ? errorStatus === 429
                        ? 'Tjedni limit je iskorišten'
                        : 'Analiza nije uspjela'
                    : 'Pitaj suncokret';
    const statusDescription =
        resultSource === 'history' && phase === 'done'
            ? 'Prikazujem spremljene savjete suncokreta za ovaj dnevnički unos.'
            : phase === 'thinking'
              ? 'Skeniram sve fotografije i tražim tragove stresa, rasta i hitnih koraka.'
              : phase === 'typing'
                ? 'Preporuke se ispisuju u AI dnevničkom formatu.'
                : phase === 'done'
                  ? 'Odgovor je spremljen i u dnevnik, a ovdje ga vidiš odmah.'
                  : phase === 'error'
                    ? errorStatus === 429
                        ? 'Novi AI savjeti bit će dostupni nakon što dio tjednog prozora istekne.'
                        : 'Provjeri poruku ispod i pokušaj ponovno s istim fotografijama.'
                    : 'Pokreni analizu svih fotografija iz dnevnika.';
    const selectedHistoryEntry = historyEntries?.find(
        (historyEntry) => historyEntry.id === selectedHistoryEntryId,
    );
    const analysisTimestamp =
        resultSource === 'history' && phase === 'done'
            ? selectedHistoryEntry?.timestamp
            : phase === 'done'
              ? analysisCompletedAt
              : null;
    const formattedAnalysisTimestamp = analysisTimestamp?.toLocaleString(
        'hr-HR',
        {
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            month: 'long',
            year: 'numeric',
        },
    );
    const canAnalyzeEntry =
        !latestCompleteHistoryEntry &&
        (phase === 'idle' || (phase === 'error' && errorStatus !== 429));

    return (
        <>
            <Stack spacing={2} className="items-end">
                <ButtonGreen
                    size="sm"
                    className="w-fit self-end px-3"
                    onClick={(event) => {
                        event.stopPropagation();
                        handlePrimaryAction();
                    }}
                    startDecorator={
                        <Image
                            src="https://cdn.gredice.com/sunflower-large.svg"
                            alt="Suncokret"
                            width={18}
                            height={18}
                        />
                    }
                >
                    {latestCompleteHistoryEntry
                        ? 'Pregledaj savjete suncokreta'
                        : 'Pitaj suncokret za savjete'}
                </ButtonGreen>
            </Stack>
            <Modal
                open={open}
                onOpenChange={handleOpenChange}
                title="AI analiza fotografije"
                className="md:max-w-4xl"
            >
                <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                    <Stack spacing={4}>
                        <div className="relative overflow-hidden rounded-3xl border bg-card shadow-xs">
                            <div className="relative aspect-square overflow-hidden bg-black/5">
                                <Image
                                    src={selectedImageUrl}
                                    alt={`Fotografija unosa ${entryName}`}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 768px) 100vw, 320px"
                                />
                                {phase === 'thinking' && (
                                    <>
                                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(254,240,138,0.14),transparent_58%),linear-gradient(180deg,rgba(120,53,15,0.02)_0%,rgba(120,53,15,0.12)_100%)]" />
                                        <div
                                            className={`${styles.scanBeam} pointer-events-none absolute -inset-x-[16%] top-[-30%] h-[28%] rounded-full`}
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                        {imageUrls.length > 1 && (
                            <Row spacing={2} className="flex-wrap">
                                {imageUrls.map((imageUrl, imageIndex) => {
                                    const isSelected =
                                        imageUrl === selectedImageUrl;

                                    return (
                                        <button
                                            key={imageUrl}
                                            type="button"
                                            className={`overflow-hidden rounded-2xl border transition-all ${
                                                isSelected
                                                    ? 'border-lime-400 shadow-xs ring-2 ring-lime-200'
                                                    : 'border-black/10 opacity-80 hover:opacity-100'
                                            }`}
                                            onClick={() =>
                                                setSelectedImageUrl(imageUrl)
                                            }
                                        >
                                            <div className="relative size-16">
                                                <Image
                                                    src={imageUrl}
                                                    alt={`${entryName} ${imageIndex + 1}`}
                                                    fill
                                                    className="object-cover"
                                                    sizes="64px"
                                                />
                                            </div>
                                        </button>
                                    );
                                })}
                            </Row>
                        )}
                    </Stack>
                    <Stack spacing={6}>
                        {historyEntries && historyEntries.length > 1 && (
                            <Stack spacing={2}>
                                <Typography
                                    level="body3"
                                    className="text-muted-foreground"
                                >
                                    Prethodni odgovori
                                </Typography>
                                <Row spacing={2} className="flex-wrap">
                                    {historyEntries.map((historyEntry) => {
                                        const isSelected =
                                            selectedHistoryEntryId ===
                                            historyEntry.id;

                                        return (
                                            <Button
                                                key={historyEntry.id}
                                                size="sm"
                                                variant={
                                                    isSelected
                                                        ? 'solid'
                                                        : 'outlined'
                                                }
                                                onClick={() =>
                                                    handleShowHistory(
                                                        historyEntry,
                                                    )
                                                }
                                            >
                                                {historyEntry.timestamp.toLocaleDateString(
                                                    'hr-HR',
                                                )}
                                            </Button>
                                        );
                                    })}
                                </Row>
                            </Stack>
                        )}
                        <Row spacing={4} className="items-center">
                            <div
                                className={`${
                                    phase === 'thinking'
                                        ? styles.sunflowerPulse
                                        : ''
                                } relative flex size-16 shrink-0 items-center justify-center`}
                            >
                                <Image
                                    src="https://cdn.gredice.com/sunflower-large.svg"
                                    alt="Suncokret koji razmišlja"
                                    width={56}
                                    height={56}
                                    className={
                                        phase === 'thinking'
                                            ? styles.sunflowerThinking
                                            : undefined
                                    }
                                />
                            </div>
                            <Stack spacing={1}>
                                <Typography level="body1" semiBold>
                                    {statusTitle}
                                </Typography>
                                <Typography
                                    level="body3"
                                    className="text-muted-foreground"
                                >
                                    {statusDescription}
                                </Typography>
                                {formattedAnalysisTimestamp && (
                                    <Typography
                                        level="body3"
                                        className="text-muted-foreground"
                                    >
                                        {`Analizirano ${formattedAnalysisTimestamp}`}
                                    </Typography>
                                )}
                            </Stack>
                        </Row>
                        {errorMessage ? (
                            <Alert
                                color={
                                    errorStatus === 429 ? 'warning' : 'danger'
                                }
                            >
                                <Typography level="body2">
                                    {errorMessage}
                                </Typography>
                            </Alert>
                        ) : (
                            <div className="min-h-72 rounded-3xl border bg-card p-4 text-card-foreground shadow-xs">
                                {visibleMarkdown ? (
                                    <div className="prose prose-sm max-w-none dark:prose-invert">
                                        <ReactMarkdown>
                                            {visibleMarkdown}
                                        </ReactMarkdown>
                                        {phase === 'typing' && (
                                            <span
                                                className={`${styles.cursorBlink} ml-0.5 inline-block h-[1.1rem] w-2.5 rounded-full bg-amber-300 align-text-bottom`}
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <Typography
                                        level="body2"
                                        className="text-muted-foreground"
                                    >
                                        {phase === 'thinking'
                                            ? 'Suncokret skenira sve fotografije, boje listova, tragove stresa i vrtni kontekst prije nego što napiše preporuke.'
                                            : 'Analiza će se pojaviti ovdje u markdown formatu.'}
                                    </Typography>
                                )}
                            </div>
                        )}
                        <Row
                            spacing={4}
                            className="justify-between items-center flex-wrap"
                        >
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                {`Fotografija ${Math.max(imageUrls.indexOf(selectedImageUrl), 0) + 1} od ${imageUrls.length}`}
                            </Typography>
                            {canAnalyzeEntry && (
                                <Button
                                    size="sm"
                                    variant="outlined"
                                    loading={activeMutation.isPending}
                                    onClick={beginAnalysis}
                                >
                                    Pokušaj ponovno
                                </Button>
                            )}
                        </Row>
                    </Stack>
                </div>
            </Modal>
        </>
    );
}
