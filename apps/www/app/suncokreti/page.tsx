import { SectionData } from "@signalco/cms-core/SectionData";
import { SectionsView } from "@signalco/cms-core/SectionsView";
import { sectionsComponentRegistry } from "../../components/shared/sectionsComponentRegistry";
import { Stack } from "@signalco/ui-primitives/Stack";
import { PageHeader } from "../../components/shared/PageHeader";

const sectionsData: SectionData[] = [
    {
        component: 'Faq1',
        header: 'Sve što trebaš znati o suncokretima',
        description: 'Suncokreti ne dolaze samo u jednoj boji i veličini. Postoje različite vrste suncokreta, a svaka od njih ima svoje karakteristike i boje.',
        features: [
            {
                header: "Što su suncokreti?",
                description: "Suncokreti su vrsta bodova na tvom Gredice racunu koje dobiva za razne radnje i pomocu kojih mozes uciniti svoj vrt sto lijepsim i zdravijim."
            },
            {
                header: "Kako skupljam suncokrete?",
                description: "Suncokrete dobiješ prilikom registracije, redovnim posjetima svog vrta, te za svaku odrađenu akciju u vrtu. Također, za svaku kupnju od 1 EUR dobivaš 🌻 10."
            },
            {
                header: "Za što se mogu koristiti suncokreti?",
                description: "Suncokrete možeš koristiti za ukrašavanje svog vrta te brigu o gredicama i biljkama. Suncokrete možeš koristiti umjesto plaćanja pojedinih akcija. 1 EUR je jednako 🌻 1000 prilikom korištenja za akcije u svom vrtu."
            }
        ]
    }
];

export default function SunflowersPage() {
    return (
        <Stack>
            <PageHeader 
            header="Suncokreti" 
            subHeader={`Sakupljanje suncokrete i koristi ih u svom vrtu za uređenje i dekoraciju.`}
            padded 
            visual={(
                <img
                    src="https://cdn.gredice.com/sunflower-large.svg"
                    alt="Suncokret"
                    width={192}
                    height={192} />
            )} />
            <SectionsView
                sectionsData={sectionsData}
                componentsRegistry={sectionsComponentRegistry} />
        </Stack>
    );
}