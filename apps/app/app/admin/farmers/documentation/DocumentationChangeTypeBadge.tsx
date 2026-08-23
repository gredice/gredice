import { Chip, type ColorPaletteProp } from '@gredice/ui/Chip';
import {
    documentationChangeLabel,
    type FarmerDocumentationChangeType,
} from './farmerDocumentationData';

const documentationChangeColor: Record<
    FarmerDocumentationChangeType,
    ColorPaletteProp
> = {
    discard: 'error',
    insert: 'success',
    replace: 'info',
};

export function DocumentationChangeTypeBadge({
    type,
}: {
    type: FarmerDocumentationChangeType;
}) {
    return (
        <Chip color={documentationChangeColor[type]} size="sm" variant="soft">
            {documentationChangeLabel(type)}
        </Chip>
    );
}
