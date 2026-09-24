'use client';
import dynamic from 'next/dynamic';
import { type ReactNode, useMemo } from 'react';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useGameState } from '../useGameState';
import { useOverviewSectionParam } from '../useUrlState';
import { findRaisedBedByBlockId } from '../utils/raisedBedBlocks';
import { HudCard } from './components/HudCard';
import { SuncokretChatPanel } from './SuncokretChatPanel';
import { SuncokretChatPositioner } from './SuncokretChatPositioner';
import { useSuncokretChat } from './SuncokretChatProvider';
import { SuncokretChatTrigger } from './SuncokretChatTrigger';
import {
    resolveSuncokretUiContext,
    suncokretConversationLabel,
} from './suncokretChatContext';

const SuncokretPhotoAnalysisChat = dynamic(() =>
    import('./SuncokretPhotoAnalysisChat').then(
        (module) => module.SuncokretPhotoAnalysisChat,
    ),
);

export function SuncokretChatHud() {
    const chat = useSuncokretChat();
    const { data: currentGarden } = useCurrentGarden();
    const [settingsSection] = useOverviewSectionParam();
    const view = useGameState((state) => state.view);
    const closeupBlock = useGameState((state) => state.closeupBlock);
    const raisedBed = closeupBlock
        ? findRaisedBedByBlockId(currentGarden, closeupBlock.id)
        : null;
    const defaultGardenId = currentGarden?.id ?? null;
    const defaultRaisedBedId = raisedBed?.id ?? null;
    const defaultUiContext = useMemo(
        () =>
            resolveSuncokretUiContext({
                raisedBedName: raisedBed?.name,
                settingsSection,
            }),
        [raisedBed?.name, settingsSection],
    );
    const target = chat?.target ?? {
        conversationLabel: suncokretConversationLabel({
            gardenName: currentGarden?.name,
            raisedBedName: raisedBed?.name,
            settingsSection,
        }),
        gardenId: defaultGardenId,
        raisedBedId:
            defaultUiContext.surface === 'raised-bed'
                ? defaultRaisedBedId
                : null,
        positionIndex: null,
        uiContext: defaultUiContext,
    };
    const isCloseup = view === 'closeup';
    if (!chat) return null;
    const renderPanel = (panel: ReactNode) =>
        chat.open ? (
            <SuncokretChatPositioner
                anchorElement={chat.anchorElement}
                isCloseup={isCloseup}
                onClose={chat.closeChat}
            >
                {panel}
            </SuncokretChatPositioner>
        ) : null;
    return (
        <>
            {!isCloseup && (
                <HudCard
                    open
                    position="floating"
                    className="static border-amber-400 bg-amber-100 p-0 dark:border-amber-700 dark:bg-amber-950"
                    data-suncokret-hud-trigger
                >
                    <SuncokretChatTrigger
                        action="toggle-default"
                        title="Suncokret AI"
                        variant="hud"
                    />
                </HudCard>
            )}
            <SuncokretChatPanel
                key={defaultGardenId}
                open={chat.open && !target.photoAnalysis}
                target={target}
                onClose={chat.closeChat}
                renderPanel={(panel) =>
                    !target.photoAnalysis ? renderPanel(panel) : null
                }
            />
            {target.photoAnalysis && (
                <SuncokretPhotoAnalysisChat
                    key={target.photoAnalysis.key}
                    open={chat.open}
                    target={target}
                    analysis={target.photoAnalysis}
                    openRequest={chat.openRequest}
                    onClose={chat.closeChat}
                    renderPanel={renderPanel}
                />
            )}
        </>
    );
}
