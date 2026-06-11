import { SignedIn, SignedOut } from '@gredice/ui/auth';
import type { ComponentProps } from 'react';
import LoginModal from '../components/auth/LoginModal';
import { GameSceneWithAnalytics } from '../components/game/GameSceneWithAnalytics';
import {
    enableDebugHudFlag,
    lsystemPlantsFlag,
    plantHistoryFlag,
    rainWetOverlayFlag,
    raisedBedImageAIFlag,
    tutorialChecklistFlag,
} from './flags';

export default async function Home() {
    const flags: ComponentProps<typeof GameSceneWithAnalytics>['flags'] = {
        enableDebugHudFlag: await enableDebugHudFlag(),
        enablePlantGeneratorFlag: await lsystemPlantsFlag(),
        enableRainWetOverlayFlag: await rainWetOverlayFlag(),
        raisedBedImageAI: await raisedBedImageAIFlag(),
        enablePlantHistoryFlag: await plantHistoryFlag(),
        enableTutorialChecklistFlag: await tutorialChecklistFlag(),
    };

    return (
        <div className="grid grid-cols-1 h-[100dvh] relative overflow-hidden">
            <SignedIn>
                <GameSceneWithAnalytics flags={flags} deferDetails />
            </SignedIn>
            <SignedOut>
                <GameSceneWithAnalytics
                    flags={flags}
                    mockGarden
                    hideHud
                    deferDetails
                />
            </SignedOut>
            <SignedOut>
                <div className="relative h-full">
                    <LoginModal />
                </div>
            </SignedOut>
        </div>
    );
}
