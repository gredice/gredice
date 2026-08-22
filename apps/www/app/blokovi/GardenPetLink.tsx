import { BlockImage } from '@gredice/ui/BlockImage';
import { Link } from '@gredice/ui/Link';
import { Typography } from '@gredice/ui/Typography';
import type { GardenPet } from '../../lib/pets/gardenPets';
import { KnownPages } from '../../src/KnownPages';

export function GardenPetLink({ pet }: { pet: GardenPet }) {
    return (
        <Link
            className="flex flex-col items-center gap-2 rounded-lg p-2 no-underline transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            href={`${KnownPages.BlockPets}#${pet.slug}`}
        >
            <div className="relative size-16 overflow-hidden rounded-full border bg-muted/40 sm:size-20">
                <BlockImage
                    alt={`Dom ${pet.genitive} u 3D vrtu`}
                    blockName={pet.homeBlockName}
                    fill
                    sizes="80px"
                />
            </div>
            <Typography level="body2">{pet.name}</Typography>
        </Link>
    );
}
