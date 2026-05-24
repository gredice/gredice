import { CmsMediaImage, type SectionData } from '../cms';
import { PageHeader } from './PageHeader';

export function PageHeaderSection({
    asset,
    assetAlt,
    assetDarkUrl,
    assetUrl,
    header,
    description,
}: SectionData) {
    const visual =
        asset ??
        (assetUrl ? (
            <div className="flex size-48 items-center justify-center overflow-hidden">
                <CmsMediaImage
                    alt={assetAlt ?? ''}
                    className="h-full w-full object-cover"
                    darkSrc={assetDarkUrl}
                    src={assetUrl}
                />
            </div>
        ) : null);

    return (
        <div className="@container/cms w-full">
            <PageHeader
                header={typeof header === 'string' ? header : ''}
                responsive="container"
                subHeader={typeof description === 'string' ? description : null}
                visual={visual}
            />
        </div>
    );
}
