'use client';

import {
    countWoodenSignMessageGraphemes,
    normalizeWoodenSignMessage,
    sanitizeWoodenSignDraft,
    woodenSignBlockName,
} from '@gredice/js/woodenSign';
import { Button } from '@gredice/ui/Button';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { type SubmitEvent, useEffect, useState } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { useBlockMessage } from '../hooks/useBlockMessage';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { GameModal } from '../shared-ui/game-modal';
import { useWoodenSignParam } from '../useUrlState';
import { WoodenSignPreview } from './WoodenSignPreview';

function WoodenSignEditor({
    blockId,
    initialMessage,
    onClose,
}: {
    blockId: string;
    initialMessage: string;
    onClose: () => void;
}) {
    const [draft, setDraft] = useState(initialMessage);
    const updateMessage = useBlockMessage();
    const { track } = useGameAnalytics();
    const characterCount = countWoodenSignMessageGraphemes(draft);

    const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        const message = normalizeWoodenSignMessage(draft);
        if ((initialMessage || null) === message) {
            onClose();
            return;
        }

        try {
            await updateMessage.mutateAsync({ blockId, message: draft });
            track('game_wooden_sign_message_saved', {
                block_id: blockId,
                character_count: characterCount,
                line_count: message?.split('\n').length ?? 0,
            });
            onClose();
        } catch (error) {
            console.error('Failed to save wooden sign message', error);
        }
    };

    const errorMessage =
        updateMessage.error instanceof Error
            ? updateMessage.error.message
            : null;

    return (
        <form onSubmit={handleSubmit}>
            <Stack spacing={4}>
                <WoodenSignPreview
                    value={draft}
                    onChange={(event) => {
                        setDraft(sanitizeWoodenSignDraft(event.target.value));
                        updateMessage.reset();
                    }}
                />
                {errorMessage ? (
                    <Typography
                        level="body2"
                        className="text-red-600 dark:text-red-400"
                        role="alert"
                    >
                        {errorMessage}
                    </Typography>
                ) : null}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="outlined"
                        onClick={onClose}
                        disabled={updateMessage.isPending}
                    >
                        Odustani
                    </Button>
                    <Button type="submit" loading={updateMessage.isPending}>
                        Spremi natpis
                    </Button>
                </div>
            </Stack>
        </form>
    );
}

export function WoodenSignModal() {
    const [woodenSignParam, setWoodenSignParam] = useWoodenSignParam();
    const { data: garden, isLoading } = useCurrentGarden();
    const block = garden?.stacks
        .flatMap((stack) => stack.blocks)
        .find((candidate) => candidate.id === woodenSignParam);
    const isOpen = Boolean(woodenSignParam);

    const handleClose = () => setWoodenSignParam(null);

    useEffect(() => {
        if (
            woodenSignParam &&
            garden &&
            !isLoading &&
            (!block || block.name !== woodenSignBlockName)
        ) {
            setWoodenSignParam(null);
        }
    }, [block, garden, isLoading, setWoodenSignParam, woodenSignParam]);

    return (
        <GameModal
            open={isOpen}
            onOpenChange={(open) => !open && handleClose()}
            title="Uredi drveni natpis"
            description="Upiši tekst koji će se prikazati na drvenom natpisu u vrtu."
            className="md:max-w-xl"
        >
            {block?.name === woodenSignBlockName ? (
                <WoodenSignEditor
                    key={block.id}
                    blockId={block.id}
                    initialMessage={block.message ?? ''}
                    onClose={handleClose}
                />
            ) : (
                <div className="h-64 animate-pulse rounded-lg bg-muted" />
            )}
        </GameModal>
    );
}
