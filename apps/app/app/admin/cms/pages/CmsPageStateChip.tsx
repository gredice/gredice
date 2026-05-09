import type { SelectCmsPage } from '@gredice/storage';
import { Chip } from '@signalco/ui-primitives/Chip';

export function CmsPageStateChip({ state }: { state: SelectCmsPage['state'] }) {
    return (
        <Chip color={state === 'published' ? 'primary' : 'neutral'} size="sm">
            {state === 'published' ? 'Objavljeno' : 'Draft'}
        </Chip>
    );
}
