import { GameScene } from '@gredice/game';
import { SignedOut } from '@signalco/auth-client/components';
import type { ComponentProps } from 'react';
import LoginModal from '../components/auth/LoginModal';
import {
    enableDebugHudFlag,
    enableRaisedBedDiaryFlag,
    enableRaisedBedFieldDiaryFlag,
    enableRaisedBedFieldOperationsFlag,
    enableRaisedBedFieldWateringFlag,
    enableRaisedBedOperationsFlag,
    enableRaisedBedWateringFlag,
} from './flags';

export default async function Home() {
    const flags: ComponentProps<typeof GameScene>['flags'] = {
        enableDebugHudFlag: await enableDebugHudFlag(),
        enableRaisedBedWateringFlag: await enableRaisedBedWateringFlag(),
        enableRaisedBedDiaryFlag: await enableRaisedBedDiaryFlag(),
        enableRaisedBedOperationsFlag: await enableRaisedBedOperationsFlag(),
        enableRaisedBedFieldOperationsFlag:
            await enableRaisedBedFieldOperationsFlag(),
        enableRaisedBedFieldWateringFlag:
            await enableRaisedBedFieldWateringFlag(),
        enableRaisedBedFieldDiaryFlag: await enableRaisedBedFieldDiaryFlag(),
    };

    return (
        <div className="grid grid-cols-1 h-[100dvh] relative overflow-hidden">
            <GameScene flags={flags} />
            <SignedOut>
                <LoginModal />
            </SignedOut>
        </div>
    );
}
