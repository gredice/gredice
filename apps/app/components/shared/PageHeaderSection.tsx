import type { SectionData } from '@signalco/cms-core/SectionData';
import { PageHeader } from './PageHeader';

export function PageHeaderSection({ header, description }: SectionData) {
    return (
        <PageHeader
            header={typeof header === 'string' ? header : ''}
            subHeader={typeof description === 'string' ? description : null}
        />
    );
}
