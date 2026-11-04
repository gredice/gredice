import { Sprout } from '@gredice/ui/icons';
import { getLandingSeasonalPlants } from '../../app/getLandingSeasonalPlants';
import { HighlightChip, type HighlightChipHref } from './HighlightChip';

/** Names up to two plants that can be sown this month; hidden off-season. */
export async function SeasonHighlightChip({
    href,
}: {
    href: HighlightChipHref;
}) {
    const seasonal = await getLandingSeasonalPlants();
    if (!seasonal?.isSeasonal) {
        return null;
    }

    const names = seasonal.sowablePlants
        .slice(0, 2)
        .map((plant) => plant.information.name.toLocaleLowerCase('hr-HR'));

    return (
        <HighlightChip href={href} icon={<Sprout aria-hidden />}>
            Sad u sezoni: {names.join(' i ')}
        </HighlightChip>
    );
}
