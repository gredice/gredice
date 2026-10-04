import { NuqsAdapter } from 'nuqs/adapters/react';
import { useState } from 'react';
import { Vector3 } from 'three';
import { PumpkinTrailViewer } from '../src/pumpkinTrail/PumpkinTrailViewer';
import {
    getPumpkinTrailRenderOnlyData,
    pumpkinTrailStacks,
} from '../src/pumpkinTrail/pumpkinTrailScene';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import {
    createDateForGameTimeOfDay,
    defaultGameLocation,
} from '../src/utils/timeOfDay';
import { PublicGardenViewer } from '../src/viewers/PublicGardenViewer';
import { PumpkinTrailProbe } from './PumpkinTrailProbe';
export function PumpkinTrailFixture({
    ordinaryPhase,
}: {
    ordinaryPhase?: 'day' | 'night';
}) {
    const [report, setReport] = useState('');
    return (
        <div data-testid="pumpkin-trail-fixture" data-report={report}>
            <NuqsAdapter>
                {ordinaryPhase ? (
                    <div style={{ height: 360, width: 390 }}>
                        <PublicGardenViewer
                            key={ordinaryPhase}
                            appBaseUrl={window.location.origin}
                            stacks={pumpkinTrailStacks}
                            renderOnlyBlockData={getPumpkinTrailRenderOnlyData()}
                            fixedTime={createDateForGameTimeOfDay(
                                new Date('2026-10-03T12:00:00Z'),
                                ordinaryPhase === 'day' ? 0.5 : 0.94,
                                defaultGameLocation,
                            )}
                            initialView={{
                                cameraPosition: new Vector3(-100, 100, -100),
                                cameraTarget: new Vector3(0, 0.893, 0),
                                cameraZoom: 44,
                            }}
                            qualityOverride={gameQualityProfiles.low}
                            noControls
                            noSound
                            noWeather
                            renderDetails={false}
                            deferDetails={false}
                            renderGroundDecorations={false}
                            sceneChildren={
                                <PumpkinTrailProbe onReport={setReport} />
                            }
                        />
                    </div>
                ) : (
                    <PumpkinTrailViewer
                        appBaseUrl={window.location.origin}
                        sceneChildren={
                            <PumpkinTrailProbe onReport={setReport} />
                        }
                    />
                )}
            </NuqsAdapter>
        </div>
    );
}
