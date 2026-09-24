import { sanitizeRaisedBedAiMarkdown } from '@gredice/js/ai';
import { Button } from '@gredice/ui/Button';
import { ChatMarker } from '@gredice/ui/Chat';
import { LoaderSpinner } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AiAnalysisRequestError } from '../hooks/aiAnalysisError';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useRaisedBedAiAnalysis } from '../hooks/useRaisedBedAiAnalysis';
import { useRaisedBedAiHistory } from '../hooks/useRaisedBedAiHistory';
import { useRaisedBedFieldAiAnalysis } from '../hooks/useRaisedBedFieldAiAnalysis';
import type { PhotoAnalysisRequest } from './raisedBed/photoAnalysisChat';
import {
    buildRaisedBedAnalysisChatSeed,
    getRaisedBedAnalysisConversationId,
} from './raisedBed/raisedBedAnalysisChatSeed';
import { SuncokretChatMessage } from './SuncokretChatMessage';
import { SuncokretChatPanel } from './SuncokretChatPanel';
import type { SuncokretChatTarget } from './SuncokretChatProvider';
import { seedMessages } from './suncokretChatUtils';

export function SuncokretPhotoAnalysisChat({
    open,
    target,
    analysis,
    openRequest,
    onClose,
    renderPanel,
}: {
    open: boolean;
    target: SuncokretChatTarget;
    analysis: PhotoAnalysisRequest;
    openRequest: number;
    onClose: () => void;
    renderPanel: (panel: ReactNode) => ReactNode;
}) {
    const [selectedId, setSelectedId] = useState(analysis.historyEntryId);
    const [previousOpenRequest, setPreviousOpenRequest] = useState(openRequest);
    if (previousOpenRequest !== openRequest) {
        setPreviousOpenRequest(openRequest);
        setSelectedId(analysis.historyEntryId);
    }
    const [markdown, setMarkdown] = useState('');
    const [phase, setPhase] = useState<
        'thinking' | 'typing' | 'done' | 'error'
    >('thinking');
    const [failure, setFailure] = useState<Error | null>(null);
    const started = useRef(false);
    const requestId = useRef(0);
    const selected = analysis.historyEntries?.find(
        (entry) => entry.id === selectedId,
    );
    const currentUser = useCurrentUser(open);
    const history = useRaisedBedAiHistory(
        analysis.gardenId,
        target.raisedBedId ?? 0,
        { enabled: open && !selected && phase === 'done' },
    );
    const bedAnalysis = useRaisedBedAiAnalysis();
    const fieldAnalysis = useRaisedBedFieldAiAnalysis();
    const saved =
        selected ??
        (phase === 'done' ? history.data : undefined)?.find(
            (entry) =>
                sanitizeRaisedBedAiMarkdown(entry.description ?? '') ===
                    markdown &&
                analysis.imageUrls.every((url) =>
                    entry.imageUrls?.includes(url),
                ),
        );
    const conversationId =
        saved && currentUser.data?.id
            ? getRaisedBedAnalysisConversationId(saved.id, currentUser.data.id)
            : undefined;
    const ready = Boolean(conversationId && saved);
    const photoAnalysis = {
        positionIndex: target.positionIndex ?? undefined,
        gardenId: analysis.gardenId,
        entryName: analysis.entryName,
        imageUrls: selected?.imageUrls?.length
            ? selected.imageUrls
            : analysis.imageUrls,
    };
    const seed = buildRaisedBedAnalysisChatSeed({
        id: conversationId ?? 'analysis-in-progress',
        analysisMarkdown: selected?.description ?? markdown,
        analyzedAt: saved?.timestamp,
        photoAnalysis,
        positionIndex: target.positionIndex ?? undefined,
        referenceDate: analysis.referenceDate,
    });

    function beginAnalysis() {
        if (!target.raisedBedId) return;
        const id = ++requestId.current;
        setFailure(null);
        setMarkdown('');
        setPhase('thinking');
        const variables = {
            gardenId: analysis.gardenId,
            raisedBedId: target.raisedBedId,
            imageUrls: analysis.imageUrls,
            referenceDate: analysis.referenceDate,
            onChunk: (text: string) => {
                if (requestId.current !== id) return;
                setMarkdown(text);
                setPhase('typing');
            },
        };
        const callbacks = {
            onSuccess: ({ markdown: text }: { markdown: string }) => {
                if (requestId.current !== id) return;
                setMarkdown(text);
                setPhase('done');
            },
            onError: (error: Error) => {
                if (requestId.current !== id) return;
                setFailure(error);
                setPhase('error');
            },
        };
        if (typeof target.positionIndex === 'number')
            fieldAnalysis.mutate(
                { ...variables, positionIndex: target.positionIndex },
                callbacks,
            );
        else bedAnalysis.mutate(variables, callbacks);
    }

    useEffect(() => {
        if (!open || selected || started.current) return;
        started.current = true;
        beginAnalysis();
    });

    const preview = seedMessages(seed)[0];
    const waitingForHistory = selected || phase === 'done';
    const preparing = !ready ? (
        <Stack spacing={3}>
            <SuncokretChatMessage
                message={preview}
                debug={false}
                isStreaming={phase === 'typing'}
                addToolApprovalResponse={async () => {}}
            />
            {failure ? (
                <div role="alert" className="text-sm text-destructive">
                    {failure.message}
                    {!(
                        failure instanceof AiAnalysisRequestError &&
                        failure.status === 429
                    ) && (
                        <Button
                            size="sm"
                            variant="plain"
                            onClick={beginAnalysis}
                        >
                            Pokušaj ponovno
                        </Button>
                    )}
                </div>
            ) : waitingForHistory ? (
                <div role="status" className="text-sm text-muted-foreground">
                    {currentUser.isError ||
                    history.isError ||
                    (!currentUser.isLoading && !history.isFetching)
                        ? 'Razgovor još nije dostupan.'
                        : 'Pripremam razgovor...'}
                    <Button
                        size="sm"
                        variant="plain"
                        onClick={() => {
                            void currentUser.refetch();
                            if (!selected) void history.refetch();
                        }}
                    >
                        Pokušaj ponovno
                    </Button>
                </div>
            ) : (
                <ChatMarker
                    role="status"
                    icon={
                        <LoaderSpinner className="animate-spin motion-reduce:animate-none" />
                    }
                >
                    {phase === 'typing'
                        ? 'Suncokret piše analizu...'
                        : 'Suncokret pregledava fotografije...'}
                </ChatMarker>
            )}
        </Stack>
    ) : undefined;
    const seedActions =
        (analysis.historyEntries?.length ?? 0) > 1 ? (
            <select
                aria-label="Odaberi analizu"
                className="w-full rounded-lg border bg-background px-2 py-1 text-xs"
                value={selectedId}
                onChange={(event) => {
                    requestId.current += 1;
                    setSelectedId(Number(event.target.value));
                }}
            >
                {analysis.historyEntries?.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                        {entry.timestamp.toLocaleString('hr-HR', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                        })}
                    </option>
                ))}
            </select>
        ) : undefined;
    return (
        <SuncokretChatPanel
            key={conversationId ?? 'preparing'}
            open={open}
            target={{ ...target, seed: ready ? seed : undefined }}
            conversationId={conversationId}
            openRequest={openRequest}
            preparation={preparing}
            seedActions={seedActions}
            onClose={onClose}
            renderPanel={renderPanel}
        />
    );
}
