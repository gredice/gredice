import type { SectionData } from '@signalco/cms-core/SectionData';
import { SectionsView } from '@signalco/cms-core/SectionsView';
import { Logotype } from '../../www/components/Logotype';
import { sectionsComponentRegistry } from '../../www/components/shared/sectionsComponentRegistry';
import { KnownPages } from '../../www/src/KnownPages';

const wwwOrigin = 'https://www.gredice.com';

const footerSections: SectionData[] = [
    {
        asset: <Logotype className="h-auto w-52" />,
        component: 'Footer1',
        features: [
            {
                ctas: [
                    { href: toWwwUrl(KnownPages.Landing), label: 'Naslovnica' },
                    { href: toWwwUrl(KnownPages.AboutUs), label: 'O nama' },
                    { href: toWwwUrl(KnownPages.Contact), label: 'Kontakt' },
                ],
                header: 'Gredice',
            },
            {
                ctas: [
                    {
                        href: toWwwUrl(KnownPages.LegalPrivacy),
                        label: 'Politika privatnosti',
                    },
                    {
                        href: toWwwUrl(KnownPages.LegalTerms),
                        label: 'Uvjeti korištenja',
                    },
                ],
                header: 'Pravno',
            },
            {
                ctas: [
                    { href: '/', label: 'Status sustava' },
                    { href: '/api/status', label: 'JSON status' },
                ],
                header: 'Status',
            },
        ],
        tagline: 'Gredice d.o.o',
    },
];

export function StatusFooter() {
    return (
        <footer className="site-footer status-footer">
            <SectionsView
                componentsRegistry={sectionsComponentRegistry}
                sectionsData={footerSections}
            />
        </footer>
    );
}

function toWwwUrl(path: string) {
    return new URL(path, wwwOrigin).toString();
}
