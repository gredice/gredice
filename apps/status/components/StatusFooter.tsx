import { Footer1 } from '@signalco/cms-components-marketing/Footer';
import type { SectionData } from '@signalco/cms-core/SectionData';
import { SectionsView } from '@signalco/cms-core/SectionsView';
import { memo } from 'react';
import { Logotype } from '../../www/components/Logotype';

const wwwOrigin = 'https://www.gredice.com';
const statusFooterComponentRegistry = {
    Footer1: memo(Footer1),
};

const footerSections: SectionData[] = [
    {
        asset: <Logotype className="h-auto w-52" />,
        component: 'Footer1',
        features: [
            {
                ctas: [
                    { href: toWwwUrl('/'), label: 'Naslovnica' },
                    { href: toWwwUrl('/o-nama'), label: 'O nama' },
                    { href: toWwwUrl('/kontakt'), label: 'Kontakt' },
                ],
                header: 'Gredice',
            },
            {
                ctas: [
                    {
                        href: toWwwUrl('/legalno/politika-privatnosti'),
                        label: 'Politika privatnosti',
                    },
                    {
                        href: toWwwUrl('/legalno/uvjeti-koristenja'),
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
                componentsRegistry={statusFooterComponentRegistry}
                sectionsData={footerSections}
            />
        </footer>
    );
}

function toWwwUrl(path: string) {
    return new URL(path, wwwOrigin).toString();
}
