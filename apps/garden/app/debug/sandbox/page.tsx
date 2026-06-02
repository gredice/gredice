import { defaultLocalSandboxStorageKey, GameScene } from '@gredice/game';
import type { ComponentProps } from 'react';
import { SandboxDebugActions } from './SandboxDebugActions';

const debugSandboxFlags = {
    enableDebugHudFlag: true,
    enableRainWetOverlayFlag: true,
} satisfies NonNullable<ComponentProps<typeof GameScene>['flags']>;

export default function DebugSandboxPage() {
    return (
        <main className="relative h-screen w-screen overflow-hidden bg-[#e7e2cc]">
            <GameScene
                className="h-full w-full"
                dayNightCycleDisabled={false}
                deferDetails={false}
                flags={debugSandboxFlags}
                localSandboxStorageKey={defaultLocalSandboxStorageKey}
                noSound
            />
            <SandboxDebugActions storageKey={defaultLocalSandboxStorageKey} />
        </main>
    );
}
