import type { FaqData } from '@gredice/client';
import { QUALITY_HARVEST_SAFETY_PATH } from '../../src/publicPagePaths.ts';

const category = {
    id: -451,
    information: {
        name: 'kvaliteta-i-sigurnost-uroda',
        label: 'Kvaliteta i sigurnost uroda',
    },
};

const timestamp = '2026-06-03T00:00:00.000Z';

function faqEntry({
    content,
    header,
    id,
    slug,
}: {
    content: string;
    header: string;
    id: number;
    slug: string;
}): FaqData {
    return {
        id,
        slug,
        entityType: {
            id: 2,
            name: 'faq',
            label: 'FAQ',
        },
        information: {
            header,
            content,
            name: slug,
        },
        attributes: {
            category,
            tags: ['kvaliteta', 'sigurnost', 'urod'],
        },
        createdAt: timestamp,
        updatedAt: timestamp,
    };
}

export const qualityHarvestSafetyFaqEntries: FaqData[] = [
    faqEntry({
        id: -45101,
        slug: 'kvaliteta-haccp-certifikacija',
        header: 'Komunicirate li formalnu HACCP certifikaciju?',
        content: `Ne. Gredice u ovom modelu pružaju uslugu planiranja, uzgoja, njege, berbe i dostave korisnikova uroda. Trenutno javno komuniciramo interne postupke temeljene na dobroj praksi, sljedivosti, evidencijama, korektivnim radnjama i načelima HACCP-a. Više: [Kvaliteta i sigurnost uroda](${QUALITY_HARVEST_SAFETY_PATH}).`,
    }),
    faqEntry({
        id: -45102,
        slug: 'kvaliteta-pracenje-sigurnosti',
        header: 'Znači li to da ne pratite sigurnost uroda?',
        content: `Ne. Pratimo rizike, čistoću, rukovanje, berbu, dostavu i prigovore kako bi se svaka sumnja mogla procijeniti i zapisati. Više: [Kvaliteta i sigurnost uroda](${QUALITY_HARVEST_SAFETY_PATH}).`,
    }),
    faqEntry({
        id: -45103,
        slug: 'kvaliteta-dokumentirani-postupci',
        header: 'Koje postupke imate dokumentirane?',
        content: `Dokumentirani su postupci za osobnu higijenu, edukaciju, procjenu gredice, vodu, inpute, čišćenje alata i gajbi, berbu, sortiranje, dostavu, sljedivost, prigovore i godišnju reviziju. Više: [Kvaliteta i sigurnost uroda](${QUALITY_HARVEST_SAFETY_PATH}).`,
    }),
    faqEntry({
        id: -45104,
        slug: 'kvaliteta-pranje-uroda',
        header: 'Može li se urod jesti bez pranja?',
        content: `Ne komuniciramo takvu tvrdnju. Urod je svježe ubrano povrće i bilje koje korisnik prije konzumacije treba oprati i pripremiti na uobičajen higijenski način. Više: [Kvaliteta i sigurnost uroda](${QUALITY_HARVEST_SAFETY_PATH}).`,
    }),
    faqEntry({
        id: -45105,
        slug: 'kvaliteta-sumnja-na-problem',
        header: 'Što radite ako postoji sumnja na problem?',
        content: `Ako postoji sumnja na kontaminaciju, pogrešnu primjenu sredstva, ulazak životinja, poplavu, prljavu opremu ili izgubljenu sljedivost, urod se zadržava ili izdvaja dok se ne procijeni. Problem se zapisuje i provodi se korektivna radnja. Više: [Kvaliteta i sigurnost uroda](${QUALITY_HARVEST_SAFETY_PATH}).`,
    }),
    faqEntry({
        id: -45106,
        slug: 'kvaliteta-promjena-modela',
        header: 'Što ako se poslovni model promijeni?',
        content: `Ako model počne uključivati prodaju, preradu, pakiranje, skladištenje ili distribuciju hrane kao tržišnog proizvoda, prije javne objave i rada u tom modelu potrebno je ponovno provjeriti obveze i prilagoditi sustav rada. Više: [Kvaliteta i sigurnost uroda](${QUALITY_HARVEST_SAFETY_PATH}).`,
    }),
];

export function mergeQualityHarvestSafetyFaqEntries(entries: FaqData[]) {
    const existingSlugs = new Set(entries.map((entry) => entry.slug));
    return [
        ...entries,
        ...qualityHarvestSafetyFaqEntries.filter(
            (entry) => !existingSlugs.has(entry.slug),
        ),
    ];
}
