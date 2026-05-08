import { Faq1 } from '@signalco/cms-components-marketing/Faq';
import { Feature1 } from '@signalco/cms-components-marketing/Feature';
import { Footer1 } from '@signalco/cms-components-marketing/Footer';
import { Heading1 } from '@signalco/cms-components-marketing/Heading';
import { memo } from 'react';

export const sectionsComponentRegistry = {
    Heading1: memo(Heading1),
    Faq1: memo(Faq1),
    Feature1: memo(Feature1),
    Footer1: memo(Footer1),
};
