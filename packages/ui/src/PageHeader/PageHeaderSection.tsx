import type { SectionData } from '../cms';
import { PageHeader } from './PageHeader';

export function PageHeaderSection({
    asset,
    assetAlt,
    assetUrl,
    header,
    description,
}: SectionData) {
    const visual =
        asset ??
        (assetUrl ? (
            <div className="flex size-48 items-center justify-center overflow-hidden">
                {/** biome-ignore lint/performance/noImgElement: CMS image URLs are remote and not known at build time. */}
                <img
                    alt={assetAlt ?? ''}
                    className="h-full w-full object-cover"
                    src={assetUrl}
                />
            </div>
        ) : null);

    return (
        <PageHeader
            header={typeof header === 'string' ? header : ''}
            subHeader={typeof description === 'string' ? description : null}
            visual={visual}
        />
    );
}
