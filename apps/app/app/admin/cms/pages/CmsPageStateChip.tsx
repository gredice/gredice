import type { SelectCmsPage } from '@gredice/storage';
import { Chip } from '@gredice/ui/Chip';

function stateMeta(state: SelectCmsPage['state']): {
    color: 'info' | 'neutral' | 'primary';
    label: string;
} {
    switch (state) {
        case 'published':
            return { color: 'primary', label: 'Objavljeno' };
        case 'in-review':
            return { color: 'info', label: 'U pregledu' };
        default:
            return { color: 'neutral', label: 'Draft' };
    }
}

export function CmsPageStateChip({ state }: { state: SelectCmsPage['state'] }) {
    const meta = stateMeta(state);

    return (
        <Chip color={meta.color} size="sm">
            {meta.label}
        </Chip>
    );
}
