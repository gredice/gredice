import { defaultLocalSandboxStorageKey, type GameScene } from '@gredice/game';
import type { ComponentProps } from 'react';
import { getGardenGameFlags } from '../../getGardenGameFlags';
import {
    resolveGameProfileDate,
    serializeGameProfileDate,
} from '../profile/game/profileDate';
import { DebugGameScene } from './DebugGameScene';
import { SandboxDebugActions } from './SandboxDebugActions';

export const instant = false;

export default async function DebugSandboxPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const query = await searchParams;
    const freezeTime = resolveGameProfileDate(
        Array.isArray(query.date) ? query.date[0] : query.date,
    );
    const managedFlags = await getGardenGameFlags();
    const debugSandboxFlags = {
        ...managedFlags,
        enableDebugHudFlag: true,
        enableGardenAvatarFlag: true,
    } satisfies NonNullable<ComponentProps<typeof GameScene>['flags']>;
    const gardenBuildingEnabled =
        debugSandboxFlags.enableGardenBuildingSystemFlag;

    return (
        <main className="relative h-screen w-screen overflow-hidden bg-[#e7e2cc]">
            <DebugGameScene
                className="h-full w-full"
                dayNightCycleDisabled={false}
                deferDetails={false}
                flags={debugSandboxFlags}
                freezeTime={serializeGameProfileDate(freezeTime)}
                gardenStructureDebugFixture={gardenBuildingEnabled}
                localSandboxStorageKey={defaultLocalSandboxStorageKey}
                noSound
            />
            <SandboxDebugActions storageKey={defaultLocalSandboxStorageKey} />
        </main>
    );
}
