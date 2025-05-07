import { KnownPages } from "../src/KnownPages";
import { SectionsView } from "@signalco/cms-core/SectionsView";
import { SectionData } from "@signalco/cms-core/SectionData";
import { CompanyFacebook, CompanyGitHub, CompanyReddit, CompanyX } from "@signalco/ui-icons";
import { sectionsComponentRegistry } from "../components/shared/sectionsComponentRegistry";
import { Logotype } from "../components/Logotype";

const sectionsData: SectionData[] = [
    {
        component: 'Footer1',
        tagline: 'Gredice',
        asset: <Logotype className="w-[320px] h-[87px]" />,
        features: [
            {
                header: 'Informacije',
                ctas: [
                    { label: 'Biljke', href: KnownPages.Plants },
                    { label: 'Povišene gredice', href: KnownPages.RaisedBeds },
                    { label: 'Blokovi', href: KnownPages.Blocks },
                    { label: 'Suncokreti', href: KnownPages.Sunflowers },
                    { label: 'Česta pitanja', href: KnownPages.FAQ },
                    { label: 'O nama', href: KnownPages.AboutUs },
                ]
            },
            {
                header: 'Zajednice',
                ctas: [
                    { label: 'r/gredice', href: 'https://www.reddit.com/r/gredice/' },
                    { label: 'Razgovori na GitHub-u', href: 'https://github.com/gredice/gredice/discussions' },
                ]
            },
            {
                header: 'Više',
                ctas: [
                    { label: 'Politika privatnosti', href: KnownPages.LegalPrivacy },
                    { label: 'Uvjeti korištenja', href: KnownPages.LegalTerms },
                    { label: 'Politika kolačića', href: KnownPages.LegalCookies },
                    { label: 'Licenca izvnornog koda', href: KnownPages.LegalLicense },
                ]
            }
        ],
        ctas: [
            { label: 'Facebook', href: 'https://link.gredice.com/facebook', icon: <CompanyFacebook /> },
            { label: 'X', href: 'https://x.com/gredicecom', icon: <CompanyX /> },
            { label: 'reddit', href: 'https://www.reddit.com/r/gredice/', icon: <CompanyReddit /> },
            { label: 'GitHub', href: 'https://github.com/gredice', icon: <CompanyGitHub /> },
        ]
    }
];

export function Footer() {
    return (
        <footer>
            <SectionsView
                sectionsData={sectionsData}
                componentsRegistry={sectionsComponentRegistry} />
        </footer>
    );
}