import type { BlockData } from '@gredice/directory-types';
import {
    GameBlocksIcon,
    GameRulerIcon,
    GameSunflowerIcon,
} from '@gredice/ui/GameIcons';
import { AttributeCard } from '../../../components/attributes/DetailCard';

export function BlockAttributeCards({
    prices,
    attributes,
}: Pick<BlockData, 'prices' | 'attributes'>) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <AttributeCard
                icon={<GameRulerIcon aria-hidden />}
                header="Visina"
                value={`${Math.round(attributes.height * 100)} cm`}
            />
            <AttributeCard
                icon={<GameBlocksIcon aria-hidden />}
                header="Slaganje"
                value={attributes.stackable === true ? 'Da' : 'Ne'}
            />
            <AttributeCard
                icon={<GameSunflowerIcon className="size-6" />}
                header="Cijena"
                value={
                    (prices.sunflowers ?? 0) <= 0
                        ? 'Nije za kupnju'
                        : (prices.sunflowers?.toString() ?? '-')
                }
            />
        </div>
    );
}
