import { Button } from '@gredice/ui/Button';
import { useState } from 'react';
import {
    GardenSceneTransitionSurface,
    useGardenSceneTransition,
} from '../../../packages/game/src/GardenSceneTransition';

const firstGarden = { id: 1, name: 'Prvi vrt' };
const secondGarden = { id: 2, name: 'Drugi vrt' };

export function GardenSceneTransitionFixture() {
    const [garden, setGarden] = useState(firstGarden);
    const { displayedGarden, sceneVisible } = useGardenSceneTransition(garden);

    return (
        <div data-garden-id={displayedGarden?.id}>
            <Button onClick={() => setGarden(secondGarden)}>
                Promijeni vrt
            </Button>
            <Button onClick={() => setGarden(firstGarden)}>
                Vrati prvi vrt
            </Button>
            <GardenSceneTransitionSurface
                className="relative h-40 w-40"
                data-scene-garden-id={displayedGarden?.id}
                data-testid="garden-scene-transition"
                visible={sceneVisible}
            >
                <canvas data-testid="garden-canvas" />
            </GardenSceneTransitionSurface>
        </div>
    );
}
