import { Faq1, Feature1, Footer1, Heading1 } from '@gredice/ui/cms';
import { PageHeaderSection } from '@gredice/ui/PageHeader';
import { memo } from 'react';

export const sectionsComponentRegistry = {
    Heading1: memo(Heading1),
    Faq1: memo(Faq1),
    Feature1: memo(Feature1),
    Footer1: memo(Footer1),
    PageHeader: memo(PageHeaderSection),
};
