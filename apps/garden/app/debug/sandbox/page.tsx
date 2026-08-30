import { defaultLocalSandboxStorageKey, GameScene } from '@gredice/game';
import type { ComponentProps } from 'react';
import { getGardenGameFlags } from '../../getGardenGameFlags';
import { SandboxDebugActions } from './SandboxDebugActions';

export const instant = false;

export default async function DebugSandboxPage() {
    const managedFlags = await getGardenGameFlags();
    const debugSandboxFlags = {
        ...managedFlags,
        enableDebugHudFlag: true,
        enableGardenAvatarFlag: true,
    } satisfies NonNullable<ComponentProps<typeof GameScene>['flags']>;
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
