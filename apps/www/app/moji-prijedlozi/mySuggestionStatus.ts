import type { ColorPaletteProp } from '@gredice/ui/Chip';
import type { MyCommunityEdit } from '../../hooks/useMyCommunityEdits';

/** Public wording and chip colour for a suggestion's review status. */
export function mySuggestionStatus(status: MyCommunityEdit['status']): {
    label: string;
    color: ColorPaletteProp;
} {
    switch (status) {
        case 'applied':
            return { label: 'Objavljeno', color: 'success' };
        case 'rejected':
            return { label: 'Nije prihvaćeno', color: 'error' };
        case 'conflicted':
            return { label: 'Treba osvježiti', color: 'info' };
        case 'canceled':
            return { label: 'Otkazano', color: 'neutral' };
        case 'approved':
        case 'pending':
            return { label: 'Na pregledu', color: 'warning' };
    }
}

/**
 * Suggestions carry the path they were sent from. Only same-site paths are
 * turned into links.
 */
export function isSameSitePath(path: string) {
    return path.startsWith('/') && !path.startsWith('//');
}
