import type { SectionData } from '@signalco/cms-core/SectionData';
import { SectionsView } from '@signalco/cms-core/SectionsView';
import { Stack } from '@signalco/ui-primitives/Stack';
import type { Metadata } from 'next';
import Image from 'next/image';
import { Markdown } from '../../components/shared/Markdown';
import { PageHeader } from '../../components/shared/PageHeader';
import { sectionsComponentRegistry } from '../../components/shared/sectionsComponentRegistry';

export const metadata: Metadata = {
    title: 'Suncokreti',
    description: 'Sve što trebaš znati o suncokretima.',
};

const sectionsData: SectionData[] = [
    {
        component: 'Faq1',
        header: 'Sve što trebaš znati o suncokretima',
        description:
            'Suncokreti ne dolaze samo u jednoj boji i veličini. Postoje različite vrste suncokreta, a svaka od njih ima svoje karakteristike i boje.',
        features: [
            {
                header: 'Što su suncokreti?',
                description:
                    'Suncokreti su vrsta bodova na tvom Gredice računu koje dobivaš za razne radnje i pomoću kojih možeš učiniti svoj vrt što ljepšim i zdravijim.',
            },
            {
                header: 'Kako skupljam suncokrete?',
                description: (
                    <Markdown>
                        {
                            'Suncokrete dobiješ prilikom registracije, redovitim posjetima svog vrta te za svaku odrađenu radnju u vrtu. Također, za svaku kupnju od 1 € dobivaš 🌻10.\n\nUjedno, posjeti svoj vrt svaki dan i uvijek će te čekati novi 🌻.'
                        }
                    </Markdown>
                ),
            },
            {
                header: 'Za što se mogu koristiti suncokreti?',
                description:
                    'Suncokrete možeš koristiti za ukrašavanje svog vrta te brigu o gredicama i biljkama. Suncokrete možeš koristiti umjesto plaćanja pojedinih akcija. 🌻1000 je jednako 1 € prilikom korištenja za akcije ili kupnju biljaka u svom vrtu.',
            },
        ],
    },
];

export default function SunflowersPage() {
    return (
        <Stack>
            <PageHeader
                header="Suncokreti"
                subHeader={`Sakupljaj i koristi suncokrete za uređenje i dekoraciju vrta ili kupnju i brigu o svojim biljkama 🌱`}
                padded
                visual={
                    <Image
                        src="https://cdn.gredice.com/sunflower-large.svg"
                        alt="Suncokret"
                        width={192}
                        height={192}
                        priority
                    />
                }
            />
            <SectionsView
                sectionsData={sectionsData}
                componentsRegistry={sectionsComponentRegistry}
            />
        </Stack>
    );
}
