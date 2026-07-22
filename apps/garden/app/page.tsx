import { SignedIn, SignedOut } from '@gredice/ui/auth';
import type { Viewport } from 'next';
import { cookies } from 'next/headers';
import type { ComponentProps } from 'react';
import LoginModal from '../components/auth/LoginModal';
import { GameSceneWithAnalytics } from '../components/game/GameSceneWithAnalytics';
import {
    blockGeometryMergingFlag,
    enableDebugHudFlag,
    enableSuncokretChatFlag,
    enableSuncokretDebugFlag,
    rainWetOverlayFlag,
} from './flags';

const impersonationFlagCookieName = 'gredice_impersonating';

// Only the game route paints edge to edge. Other Garden routes keep the
// root viewport behavior so their document UI remains safely contained.
export const viewport: Viewport = {
    initialScale: 1,
    maximumScale: 1,
    themeColor: '#2e6f40',
    userScalable: false,
    viewportFit: 'cover',
    width: 'device-width',
};

export default async function Home() {
    const cookieStore = await cookies();
    const suppressOpeningHud =
        cookieStore.get(impersonationFlagCookieName)?.value === '1';
    const flags: ComponentProps<typeof GameSceneWithAnalytics>['flags'] = {
        enableBlockGeometryMergingFlag: await blockGeometryMergingFlag(),
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
