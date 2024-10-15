import { Stack } from "@signalco/ui-primitives/Stack";
import { PageNav } from "@signalco/ui/Nav";
import { NavigatingButton } from "@signalco/ui/NavigatingButton";
import Image from "next/image";
import Link from "next/link";
import { memo } from "react";
import { Footer1 } from '@signalco/cms-components-marketing/Footer';
import type { SectionData } from '@signalco/cms-core/SectionData';
import { SectionsView } from '@signalco/cms-core/SectionsView';
import { KnownPages } from "../../src/KnownPages";
import { CompanyGitHub, CompanyReddit, CompanyX } from "@signalco/ui-icons";

const sectionsComponentRegistry = {
    'Footer1': memo(Footer1)
}

const sectionsData: SectionData[] = [
    {
        component: 'Footer1',
        tagline: 'Gredice',
        asset: <Image src="/Logotype - gredice@2x.svg" width={320} height={87} alt="Gredice" quality={100} />,
        features: [
            {
                header: 'Informacije',
                ctas: [
                    { label: 'Biljke', href: KnownPages.Plants },
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
        ],
        ctas: [
            { label: 'X', href: 'https://x.com/gredicecom', icon: <CompanyX /> },
            { label: 'reddit', href: 'https://www.reddit.com/r/gredice/', icon: <CompanyReddit /> },
            { label: 'GitHub', href: 'https://github.com/gredice', icon: <CompanyGitHub /> },
        ]
    }
];

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <Stack>
            <PageNav
                logo={(
                    <Image src="/Logotype - gredice@2x.svg" width={180} height={40} alt="Gredice" quality={100} priority />
                )}
                links={[
                    { href: KnownPages.Plants, text: 'Biljke' },
                ]}>
                <Link href={KnownPages.GardenApp}>
                    <NavigatingButton className="bg-green-800 hover:bg-green-700">
                        Vrt
                    </NavigatingButton>
                </Link>
            </PageNav>
            <main className="mt-16 relative">
                {children}
            </main>
            <footer>
                <SectionsView
                    sectionsData={sectionsData}
                    componentsRegistry={sectionsComponentRegistry} />
            </footer>
        </Stack>
    );
}