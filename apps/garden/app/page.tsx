import { SignedIn, SignedOut } from '@gredice/ui/auth';
import { cookies } from 'next/headers';
import type { ComponentProps } from 'react';
import { TemporaryAccountBootstrap } from '../components/auth/TemporaryAccountBootstrap';
import { TemporaryAccountUpgradeModal } from '../components/auth/TemporaryAccountUpgradeModal';
import { GameSceneWithAnalytics } from '../components/game/GameSceneWithAnalytics';
import {
    enableDebugHudFlag,
    enableSuncokretChatFlag,
    enableSuncokretDebugFlag,
    rainWetOverlayFlag,
} from './flags';

const impersonationFlagCookieName = 'gredice_impersonating';

export default async function Home() {
    const cookieStore = await cookies();
    const suppressOpeningHud =
        cookieStore.get(impersonationFlagCookieName)?.value === '1';
    const flags: ComponentProps<typeof GameSceneWithAnalytics>['flags'] = {
        enableDebugHudFlag: await enableDebugHudFlag(),
        enableRainWetOverlayFlag: await rainWetOverlayFlag(),
        enableSuncokretChatFlag: await enableSuncokretChatFlag(),
        enableSuncokretDebugFlag: await enableSuncokretDebugFlag(),
    };

    return (
        <div className="grid grid-cols-1 h-[100dvh] relative overflow-hidden">
            <SignedIn>
                <GameSceneWithAnalytics
                    flags={flags}
                    deferDetails
                    suppressOpeningHud={suppressOpeningHud}
                />
            </SignedIn>
            <SignedOut>
                <TemporaryAccountBootstrap>
                    <GameSceneWithAnalytics
                        flags={flags}
                        mockGarden
                        hideHud
                        deferDetails
                    />
                </TemporaryAccountBootstrap>
            </SignedOut>
            <TemporaryAccountUpgradeModal />
        </div>
    );
}
