import { useGameState } from '../../../packages/game/src/useGameState';
import { useRaisedBedCloseup } from '../../../packages/game/src/useRaisedBedCloseup';
import { useRaisedBedCloseupParams } from '../../../packages/game/src/useUrlState';

export function GardenActionStateProbe() {
    useRaisedBedCloseup();
    const [params] = useRaisedBedCloseupParams();
    const view = useGameState((state) => state.view);
    return (
        <output data-testid="garden-action-target">
            {JSON.stringify({ ...params, view })}
        </output>
    );
}
