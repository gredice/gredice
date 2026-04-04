import { Alert } from '@signalco/ui/Alert';
import { Button } from '@signalco/ui-primitives/Button';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
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
    const [selectedImageUrl, setSelectedImageUrl] = useState(imageUrls[0] ?? '');
    const [visibleMarkdown, setVisibleMarkdown] = useState('');
    const [phase, setPhase] = useState<AnalysisPhase>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [selectedHistoryEntryId, setSelectedHistoryEntryId] = useState<
        number | null
    >(null);
    const [resultSource, setResultSource] = useState<'history' | 'analysis' | null>(
        null,
    );
    const requestIdRef = useRef(0);
    const typewriterTimerRef = useRef<ReturnType<typeof setInterval> | null>(
        null,
    );
    const raisedBedAnalysis = useRaisedBedAiAnalysis();
    const raisedBedFieldAnalysis = useRaisedBedFieldAiAnalysis();
    const activeMutation =
        typeof positionIndex === 'number'
            ? raisedBedFieldAnalysis
            : raisedBedAnalysis;
    const latestHistoryEntry = historyEntries?.[0];

    useEffect(() => {
        return () => {
            if (typewriterTimerRef.current) {
                clearInterval(typewriterTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!selectedImageUrl && imageUrls[0]) {
            setSelectedImageUrl(imageUrls[0]);
        }
    }, [imageUrls, selectedImageUrl]);

    function clearTypewriterTimer() {
        if (typewriterTimerRef.current) {
            clearInterval(typewriterTimerRef.current);
            typewriterTimerRef.current = null;
        }
    }

    function resetPresentation() {
        requestIdRef.current += 1;
        clearTypewriterTimer();
        setVisibleMarkdown('');
        setErrorMessage(null);
        setPhase('idle');
        setSelectedHistoryEntryId(null);
        setResultSource(null);
    }

    function startTypewriter(markdown: string, requestId: number) {
        clearTypewriterTimer();
        setVisibleMarkdown('');

        if (!markdown) {
            setPhase('done');
            return;
        }

        setPhase('typing');
        let index = 0;
        const chunkSize = Math.max(4, Math.ceil(markdown.length / 90));

        typewriterTimerRef.current = setInterval(() => {
            if (requestIdRef.current !== requestId) {
                clearTypewriterTimer();
                return;
            }

            index = Math.min(markdown.length, index + chunkSize);
            setVisibleMarkdown(markdown.slice(0, index));

            if (index >= markdown.length) {
                clearTypewriterTimer();
                setPhase('done');
            }
        }, 28);
    }

    function beginAnalysis(nextImageUrl: string) {
        requestIdRef.current += 1;
        const requestId = requestIdRef.current;

        clearTypewriterTimer();
        setSelectedImageUrl(nextImageUrl);
        setVisibleMarkdown('');
        setErrorMessage(null);
        setPhase('thinking');
        setSelectedHistoryEntryId(null);
        setResultSource('analysis');

        if (typeof positionIndex === 'number') {
            raisedBedFieldAnalysis.mutate(
                {
                    gardenId,
                    raisedBedId,
                    positionIndex,
                    imageUrl: nextImageUrl,
                },
                {
                    onSuccess: (data) => {
                        if (requestIdRef.current !== requestId) {
                            return;
                        }

                        startTypewriter(data.markdown, requestId);
                    },
                    onError: (error) => {
                        if (requestIdRef.current !== requestId) {
                            return;
                        }

                        clearTypewriterTimer();
                        setPhase('error');
                        setErrorMessage(error.message);
                    },
                },
            );
            return;
        }

        raisedBedAnalysis.mutate(
            {
                gardenId,
                raisedBedId,
                imageUrl: nextImageUrl,
            },
            {
                onSuccess: (data) => {
                    if (requestIdRef.current !== requestId) {
                        return;
                    }

                    startTypewriter(data.markdown, requestId);
                },
                onError: (error) => {
                    if (requestIdRef.current !== requestId) {
                        return;
                    }

                    clearTypewriterTimer();
                    setPhase('error');
                    setErrorMessage(error.message);
                },
            },
        );
    }

    function handleOpen() {
        const firstImageUrl = imageUrls[0];
        if (!firstImageUrl) {
            return;
        }

        setOpen(true);
        beginAnalysis(firstImageUrl);
    }

    function handleShowHistory(entry = latestHistoryEntry) {
        if (!entry) {
            return;
        }

        requestIdRef.current += 1;
        clearTypewriterTimer();
        setOpen(true);
        setSelectedHistoryEntryId(entry.id);
        setSelectedImageUrl(entry.imageUrls?.[0] ?? imageUrls[0] ?? '');
        setVisibleMarkdown(entry.description ?? '');
        setErrorMessage(null);
        setPhase('done');
        setResultSource('history');
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
                  ? 'Analiza nije uspjela'
                  : 'Pitaj suncokret';
    const statusDescription =
        resultSource === 'history' && phase === 'done'
            ? 'Prikazujem posljednji spremljeni AI odgovor za ovu fotografiju. Za novu provjeru pokreni analizu ponovno.'
            : phase === 'thinking'
            ? 'Skeniram fotografiju i tražim tragove stresa, rasta i hitnih koraka.'
            : phase === 'typing'
              ? 'Preporuke se ispisuju u AI dnevničkom formatu.'
              : phase === 'done'
                ? 'Odgovor je spremljen i u dnevnik, a ovdje ga vidiš odmah.'
                : phase === 'error'
                  ? 'Pokušaj ponovno s istom ili drugom fotografijom iz unosa.'
                  : 'Pokreni analizu nad fotografijom iz ovog dnevničkog unosa.';

    return (
        <>
            <Stack spacing={1} className="items-end">
                {latestHistoryEntry && (
                    <>
                        <button
                            type="button"
                            className="self-end"
                            onClick={(event) => {
                                event.stopPropagation();
                                handleShowHistory();
                            }}
                        >
                            <Chip
                                size="sm"
                                color="neutral"
                                className="w-fit cursor-pointer transition-colors hover:border-lime-300 hover:bg-lime-50"
                            >
                                {`AI upiti: ${historyEntries?.length ?? 0}`}
                            </Chip>
                        </button>
                        <Typography
                            level="body3"
                            className="text-muted-foreground text-right"
                        >
                            {`Zadnji upit ${latestHistoryEntry.timestamp.toLocaleDateString('hr-HR')}`}
                        </Typography>
                    </>
                )}
                <ButtonGreen
                    size="sm"
                    className="w-fit self-end px-3"
                    onClick={(event) => {
                        event.stopPropagation();
                        handleOpen();
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
                    Pitaj suncokret
                </ButtonGreen>
            </Stack>
            <Modal
                open={open}
                onOpenChange={handleOpenChange}
                title="AI analiza fotografije"
                className="md:max-w-4xl"
            >
                <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                    <Stack spacing={2}>
                        <div className="relative overflow-hidden rounded-3xl border bg-card shadow-sm">
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
                                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(16,24,40,0.08)_0%,rgba(16,24,40,0.2)_100%)]" />
                                        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.04)_0,rgba(255,255,255,0.04)_2px,transparent_2px,transparent_8px)]" />
                                        <div
                                            className={`${styles.scanLine} pointer-events-none absolute inset-x-[8%] top-[-12%] h-[24%] rounded-full bg-[linear-gradient(180deg,rgba(190,242,100,0)_0%,rgba(190,242,100,0.2)_25%,rgba(250,204,21,0.9)_50%,rgba(190,242,100,0.2)_75%,rgba(190,242,100,0)_100%)] shadow-[0_0_18px_rgba(250,204,21,0.55),0_0_30px_rgba(190,242,100,0.35)]`}
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                        {imageUrls.length > 1 && (
                            <Row spacing={1} className="flex-wrap">
                                {imageUrls.map((imageUrl, imageIndex) => {
                                    const isSelected =
                                        imageUrl === selectedImageUrl;

                                    return (
                                        <button
                                            key={imageUrl}
                                            type="button"
                                            className={`overflow-hidden rounded-2xl border transition-all ${
                                                isSelected
                                                    ? 'border-lime-400 shadow-sm ring-2 ring-lime-200'
                                                    : 'border-black/10 opacity-80 hover:opacity-100'
                                            }`}
                                            onClick={() => beginAnalysis(imageUrl)}
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
                    <Stack spacing={3}>
                        {historyEntries && historyEntries.length > 1 && (
                            <Stack spacing={1}>
                                <Typography
                                    level="body3"
                                    className="text-muted-foreground"
                                >
                                    Prethodni odgovori
                                </Typography>
                                <Row spacing={1} className="flex-wrap">
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
                        <Row spacing={2} className="items-center">
                            <div
                                className={`${
                                    phase === 'thinking'
                                        ? styles.sunflowerAuraPulse
                                        : ''
                                } relative rounded-full border border-lime-200 bg-lime-50 p-2 after:pointer-events-none after:absolute after:-inset-1.5 after:rounded-full after:border after:border-lime-200/80 after:opacity-0 after:content-['']`}
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
                            <Stack spacing={0.5}>
                                <Typography level="body1" semiBold>
                                    {statusTitle}
                                </Typography>
                                <Typography
                                    level="body3"
                                    className="text-muted-foreground"
                                >
                                    {statusDescription}
                                </Typography>
                                {phase === 'thinking' && (
                                    <div className="inline-flex items-center gap-1.5">
                                        <span
                                            className={`${styles.thinkingDot} size-1.5 rounded-full bg-lime-500`}
                                        />
                                        <span
                                            className={`${styles.thinkingDot} ${styles.thinkingDotDelay2} size-1.5 rounded-full bg-lime-500`}
                                        />
                                        <span
                                            className={`${styles.thinkingDot} ${styles.thinkingDotDelay3} size-1.5 rounded-full bg-lime-500`}
                                        />
                                    </div>
                                )}
                            </Stack>
                        </Row>
                        {errorMessage ? (
                            <Alert color="danger">
                                <Typography level="body2">
                                    {errorMessage}
                                </Typography>
                            </Alert>
                        ) : (
                            <div className="min-h-72 rounded-3xl border bg-background/80 p-4 shadow-sm">
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
                                            ? 'Suncokret skenira boje listova, tragove stresa i vrtni kontekst prije nego što napiše preporuke.'
                                            : 'Analiza će se pojaviti ovdje u markdown formatu.'}
                                    </Typography>
                                )}
                            </div>
                        )}
                        <Row
                            spacing={2}
                            className="justify-between items-center flex-wrap"
                        >
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                {`Fotografija ${Math.max(imageUrls.indexOf(selectedImageUrl), 0) + 1} od ${imageUrls.length}`}
                            </Typography>
                            <Button
                                size="sm"
                                variant="outlined"
                                loading={activeMutation.isPending}
                                onClick={() => beginAnalysis(selectedImageUrl)}
                            >
                                Analiziraj ponovno
                            </Button>
                        </Row>
                    </Stack>
                </div>
            </Modal>
        </>
    );
}