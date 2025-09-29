import { ExpandableText } from '../../components/shared/ExpandableText';
import { Markdown } from '../../components/shared/Markdown';
import {
    shouldMakeExpandable,
    splitContentForExpansion,
} from '../../lib/content/expandableContent';

// Sample plant information content for demonstration
const samplePlantContent = `
Rajčica je jedna od najčešće uzgajanih povrća u vrtovima širom svijeta. 

**Osnovne informacije:**
- Znanstveno ime: *Solanum lycopersicum*
- Porijeklo: Južna Amerika
- Najbolja temperatura za rast: 18-25°C

**Priprema za sijanje:**
Rajčicu možete sijati u zatvorenom prostoru 6-8 tjedana prije poslednjeg mraza. Koristite kvalitetnu zemlju za presadnice i održavajte temperaturu oko 21°C.

<!-- more -->

**Dodatne informacije o sijanju:**
Dubina sijanja trebala bi biti oko 0.5 cm. Sjeme obično klije za 5-10 dana. Važno je održavati zemlju vlažnom, ali ne prekomjerno mokrom.

**Presadnja:**
Kada su presadnice dosegnule visinu od 15-20 cm i temperatura zraka stabilno prelazi 15°C noću, možete ih presaditi u vrt.

**Napredni savjeti:**
- Koristite mulč oko biljaka da zadržite vlagu
- Postavite potpore za veće sorte
- Redovito uklanjajte strani pupovi
- Zalijevajte direktno na korijene, izbjegavajte zalijevanje listova
`;

const shortContent = `
Kratki sadržaj koji se neće proširivati jer nije dovoljno dugačak.
`;

export default function ExpandableContentDemo() {
    const longContent = splitContentForExpansion(samplePlantContent);
    const brief = splitContentForExpansion(shortContent);

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-8">
            <h1 className="text-3xl font-bold mb-6">
                Demonstracija proširivog sadržaja
            </h1>

            <div className="space-y-6">
                <section className="border rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">
                        Dugačak sadržaj s delimiterrom
                    </h2>
                    {shouldMakeExpandable(samplePlantContent) ? (
                        <ExpandableText maxHeight={150}>
                            <Markdown>{longContent.mainContent}</Markdown>
                            {longContent.additionalContent && (
                                <Markdown>
                                    {longContent.additionalContent}
                                </Markdown>
                            )}
                        </ExpandableText>
                    ) : (
                        <Markdown>{samplePlantContent}</Markdown>
                    )}
                </section>

                <section className="border rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">
                        Kratki sadržaj (neće se proširivati)
                    </h2>
                    {shouldMakeExpandable(shortContent) ? (
                        <ExpandableText maxHeight={150}>
                            <Markdown>{brief.mainContent}</Markdown>
                            {brief.additionalContent && (
                                <Markdown>{brief.additionalContent}</Markdown>
                            )}
                        </ExpandableText>
                    ) : (
                        <Markdown>{shortContent}</Markdown>
                    )}
                </section>

                <section className="border rounded-lg p-6 bg-gray-50">
                    <h3 className="text-lg font-medium mb-4">
                        Kako funkcionira
                    </h3>
                    <ul className="list-disc list-inside space-y-2 text-sm">
                        <li>
                            Sadržaj se automatski čini proširivim ako je dulji
                            od 500 znakova
                        </li>
                        <li>
                            Možete koristiti <code>{'<!-- more -->'}</code>{' '}
                            delimiter za eksplicitno dijeljenje sadržaja
                        </li>
                        <li>
                            Skraćeni sadržaj ima gradijent na dnu za vizualnu
                            oznaku
                        </li>
                        <li>
                            Gumb "Prikaži više/manje" omogućuje prebacivanje
                            između stanja
                        </li>
                        <li>Sve je animirano s glatkim prijelazima</li>
                    </ul>
                </section>
            </div>
        </div>
    );
}
