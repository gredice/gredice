import type { SelectCmsPage } from '@gredice/storage';
import { Chip } from '@gredice/ui/Chip';

export function CmsPageStateChip({ state }: { state: SelectCmsPage['state'] }) {
    return (
        <Chip color={state === 'published' ? 'primary' : 'neutral'} size="sm">
            {state === 'published' ? 'Objavljeno' : 'Draft'}
        </Chip>
    );
}
