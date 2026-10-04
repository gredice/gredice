import type { PlantData } from '@gredice/client';
import {
    GameCalendarIcon,
    GameLeafIcon,
    GameSoilIcon,
    GameSunIcon,
} from '@gredice/ui/GameIcons';
import { AttributeCard } from '../../../components/attributes/DetailCard';

export function GrowthAttributeCards({
    attributes,
}: {
    attributes: PlantData['attributes'] | undefined;
}) {
    const formatDayRange = (
        min?: number | null,
        max?: number | null,
    ): string => {
        if (min == null && max == null) {
            return '-';
        }
        if (min != null && max != null) {
            if (min === max) {
                return `${min} ${min === 1 ? 'dan' : 'dana'}`;
            }
            return `${min}-${max} dana`;
        }
        const value = min ?? max;
        return value == null ? '-' : `${value} ${value === 1 ? 'dan' : 'dana'}`;
    };

    return (
        <div className="grid grid-cols-2 gap-2">
            <AttributeCard
                icon={<GameSunIcon aria-hidden />}
                header="Svijetlost"
                value={
                    attributes?.light == null || Number.isNaN(attributes?.light)
                        ? '-'
                        : attributes.light >= 0.7
                          ? 'Sunce'
                          : attributes.light >= 0.3
                            ? 'Polu-sjena'
                            : 'Hlad'
                }
            />
            <AttributeCard
                icon={<GameSoilIcon aria-hidden />}
                header="Zemlja"
                value={attributes?.soil ?? '-'}
            />
            <AttributeCard
                icon={<GameLeafIcon aria-hidden />}
                header="Nutrijenti"
                value={attributes?.nutrients ?? '-'}
            />
            <AttributeCard
                icon={<GameCalendarIcon aria-hidden />}
                header="Vrijeme rasta"
                value={formatDayRange(
                    attributes?.growthWindowMin,
                    attributes?.growthWindowMax,
                )}
            />
        </div>
    );
}
