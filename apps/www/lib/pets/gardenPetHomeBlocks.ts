import { getBlockRouteAlias } from '../blocks/blockRoute';
import { type GardenPet, gardenPets } from './gardenPets';

type GardenPetHomeBlockCandidate = {
    slug?: string | null;
    information: {
        name: string;
        label: string;
    };
};

export function resolveGardenPetHomeBlocks<
    TBlock extends GardenPetHomeBlockCandidate,
>(blocks: readonly TBlock[] | null | undefined) {
    return gardenPets.map((pet: GardenPet) => {
        const homeBlock = blocks?.find(
            (block) => block.information.name === pet.homeBlockName,
        );

        return {
            pet,
            homeBlock,
            homeBlockAlias: homeBlock ? getBlockRouteAlias(homeBlock) : null,
        };
    });
}
