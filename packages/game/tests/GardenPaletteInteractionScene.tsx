import { AdditionalEntityInstances } from '../src/entities/AdditionalEntityInstances';
import { EntityInstancesBlock } from '../src/entities/EntityInstancesBlock';
import { StaticRenderPacketBatchProvider } from '../src/scene/compiler/StaticRenderPacketBatch';
import type { Stack } from '../src/types/Stack';
import { useGameGLTF } from '../src/utils/useGameGLTF';
import type { GardenPaletteInteractionPhase } from './GardenPaletteInteractionFixture';
import { GardenPaletteInteractionProbe } from './GardenPaletteInteractionProbe';

export function GardenPaletteInteractionScene({
    batch,
    phase,
    stacks,
}: {
    batch: boolean;
    phase: GardenPaletteInteractionPhase;
    stacks: Stack[];
}) {
    const tree = useGameGLTF('Tree');
    const box = useGameGLTF('GardenBox');
    const content = (
        <>
            {/* Same trunk inputs as production EntityInstancesAssetBlock. */}
            <EntityInstancesBlock
                name="Tree"
                stacks={stacks}
                geometry={tree.nodes.Tree_1_1.geometry}
                material={tree.nodes.Tree_1_1.material}
                yOffset={0.5}
                scale={[0.125, 0.5, 0.125]}
                staticOpaqueCacheGroup="static-props"
                batchStaticMaterial
                renderSnow={false}
            />
            {/* Uses the real body/lid, hover, open and placement components. */}
            <AdditionalEntityInstances
                stacks={stacks}
                batchStaticMaterial
                renderSnow={false}
            />
            <GardenPaletteInteractionProbe
                batch={batch}
                phase={phase}
                stacks={stacks}
                tree={tree}
                box={box}
            />
        </>
    );
    return batch ? (
        <StaticRenderPacketBatchProvider>
            {content}
        </StaticRenderPacketBatchProvider>
    ) : (
        content
    );
}
