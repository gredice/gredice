import { GameScene } from '@gredice/game';
import { SignedOut } from '@signalco/auth-client/components';
import type { ComponentProps } from 'react';
import LoginModal from '../components/auth/LoginModal';
import { enableDebugHudFlag, lsystemPlantsFlag, raisedBedImageAIFlag } from './flags';

export default async function Home() {
    const flags: ComponentProps<typeof GameScene>['flags'] = {
        enableDebugHudFlag: await enableDebugHudFlag(),
        enablePlantGeneratorFlag: await lsystemPlantsFlag(),
        raisedBedImageAI: await raisedBedImageAIFlag(),
    };

    return (
        <div className="grid grid-cols-1 h-[100dvh] relative overflow-hidden">
            <GameScene flags={flags} />
            <SignedOut>
                <div className="relative h-full">
                    <LoginModal />
                </div>
            </SignedOut>
        </div>
    );
}
