/**
 * Public presentation for block pages.
 *
 * Blocks are items inside the Gredice game, not physical products. The title
 * and the opening paragraph say so explicitly so a search result cannot be read
 * as a shop listing for a real garden product.
 */

/** Sentence appended to every block description and rendered on the page. */
export const blockVirtualItemNote =
    'Na ovoj stranici prikazujemo predmet iz aplikacije Gredice.';

/** Keep aligned with the description limit in `lib/seo/publicMetadata.ts`. */
const descriptionLimit = 190;

const blockTypeDescriptors: Record<string, string> = {
    decoration: 'ukrasni blok za virtualni vrt',
    raisedBed: 'podignuta gredica u virtualnom vrtu',
    raisedBedPart: 'dio podignute gredice u virtualnom vrtu',
    plant: 'biljka u virtualnom vrtu',
    plantPart: 'dio biljke u virtualnom vrtu',
};

const defaultBlockTypeDescriptor = 'blok za virtualni vrt';

export type BlockPagePresentationSource = {
    information: {
        label: string;
        shortDescription?: string | null;
    };
    attributes?: {
        type?: string | null;
    } | null;
};

function endWithSentenceStop(value: string) {
    return /[.!?…]$/u.test(value) ? value : `${value}.`;
}

function truncateToLimit(value: string, limit: number) {
    if (value.length <= limit) {
        return value;
    }

    return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

/** Short phrase describing what the block is inside the game. */
export function blockTypeDescriptor(block: BlockPagePresentationSource) {
    const type = block.attributes?.type?.trim();
    if (!type) {
        return defaultBlockTypeDescriptor;
    }

    return blockTypeDescriptors[type] ?? defaultBlockTypeDescriptor;
}

/** Page title, for example `Pijesak – ukrasni blok za virtualni vrt`. */
export function blockPageTitle(block: BlockPagePresentationSource) {
    return `${block.information.label} – ${blockTypeDescriptor(block)}`;
}

/**
 * Meta description and page intro: the block's own description first, then the
 * note that the page describes an in-app item.
 */
export function blockPageDescription(block: BlockPagePresentationSource) {
    const shortDescription = block.information.shortDescription?.trim();
    const intro = shortDescription
        ? endWithSentenceStop(shortDescription)
        : endWithSentenceStop(
              `${block.information.label} je ${blockTypeDescriptor(block)}`,
          );
    const availableLength = descriptionLimit - blockVirtualItemNote.length - 1;

    return `${truncateToLimit(intro, availableLength)} ${blockVirtualItemNote}`;
}
