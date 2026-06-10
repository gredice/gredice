import type {
    CmsPageRenderMaxWidth,
    CmsPageRenderMode,
    SectionData,
} from '@gredice/ui/cms';

export {
    QUALITY_HARVEST_SAFETY_LAST_REVIEWED,
    QUALITY_HARVEST_SAFETY_PATH,
    QUALITY_HARVEST_SAFETY_SLUG,
} from '../../src/publicPagePaths.ts';

import {
    QUALITY_HARVEST_SAFETY_LAST_REVIEWED,
    QUALITY_HARVEST_SAFETY_PATH,
    QUALITY_HARVEST_SAFETY_SLUG,
} from '../../src/publicPagePaths.ts';

export type SourceCmsPage = {
    slug: string;
    title: string;
    content: SectionData[];
    contentKind: 'page';
    category: string | null;
    tags: string[];
    renderMode: CmsPageRenderMode;
    renderMaxWidth: CmsPageRenderMaxWidth;
    state: 'published';
    publishedAt: string;
    metaTitle: string;
    metaDescription: string;
    metaImageUrl: string | null;
    seoImageUrl: string | null;
    canonicalPath: string;
    noIndex: false;
    updatedAt: string;
};

export const qualityHarvestSafetyCmsPage: SourceCmsPage = {
    slug: QUALITY_HARVEST_SAFETY_SLUG,
    title: 'Kvaliteta i sigurnost uroda',
    contentKind: 'page',
    category: null,
    tags: ['Kvaliteta', 'Sigurnost', 'Urod'],
    state: 'published',
    publishedAt: `${QUALITY_HARVEST_SAFETY_LAST_REVIEWED}T00:00:00.000Z`,
    updatedAt: `${QUALITY_HARVEST_SAFETY_LAST_REVIEWED}T00:00:00.000Z`,
    metaTitle: 'Kvaliteta i sigurnost uroda | Gredice',
    metaDescription:
        'Kako Gredice prate higijenu, sljedivost, berbu i dostavu svježeg uroda u trenutnom modelu usluge.',
    metaImageUrl: null,
    seoImageUrl: null,
    canonicalPath: QUALITY_HARVEST_SAFETY_PATH,
    noIndex: false,
    renderMode: 'container',
    renderMaxWidth: 'lg',
    content: [
        {
            component: 'PageHeader',
            header: 'Kvaliteta i sigurnost uroda',
            description:
                'Kako Gredice prate higijenu, sljedivost, berbu i dostavu svježeg uroda u trenutnom modelu usluge.',
        },
        {
            component: 'TextBlock',
            tagline: 'Model usluge',
            header: 'Urod ostaje korisnikov urod',
            description:
                'Gredice pružaju uslugu planiranja, uzgoja, njege, berbe i dostave uroda naručitelju. U trenutnom modelu urod ne predstavljamo kao vlastiti gotov prehrambeni proizvod, nego kao svježe ubrano povrće i bilje koje korisnik preuzima i priprema za vlastitu upotrebu.',
        },
        {
            component: 'Feature1',
            tagline: 'Kontrole',
            header: 'Što pratimo kroz sezonu',
            description:
                'Interni postupci oslanjaju se na dobru poljoprivrednu praksu, dobru higijensku praksu, sljedivost, evidencije, korektivne radnje i načela HACCP-a.',
            features: [
                {
                    iconName: 'inputs',
                    header: 'Inputi i materijali',
                    description:
                        'Porijeklo sjemena, presadnica, supstrata, gnojiva, alata i drugih materijala koji ulaze u uzgoj.',
                },
                {
                    iconName: 'water',
                    header: 'Lokacija i voda',
                    description:
                        'Stanje gredice, okolni rizici, životinjski tragovi, poplava, navodnjavanje i prikladnost vode za namjenu.',
                },
                {
                    iconName: 'hygiene',
                    header: 'Higijena i čistoća',
                    description:
                        'Higijena osoba koje rukuju urodom te čistoća alata, gajbi, radnih površina i dostavnog prostora.',
                },
                {
                    iconName: 'harvest',
                    header: 'Berba i sortiranje',
                    description:
                        'Pregled prije berbe, izdvajanje vidljivo oštećenog ili sumnjivog uroda i osnovno sortiranje prije predaje.',
                },
                {
                    iconName: 'traceability',
                    header: 'Sljedivost',
                    description:
                        'Povezivanje korisnika, gredice, sezone, berbe i dostave kako bi se u slučaju pitanja moglo provjeriti što se dogodilo.',
                },
                {
                    iconName: 'deviation',
                    header: 'Odstupanja i prigovori',
                    description:
                        'Zapisivanje sumnji, prigovora i korektivnih radnji kada postupak nije proveden kako je planirano.',
                },
            ],
        },
        {
            component: 'CalloutBlock',
            tagline: 'Obvezna napomena',
            header: 'Svježi urod treba oprati i pripremiti prije konzumacije',
            description:
                'Urod je svježe ubrano povrće i bilje. Prije konzumacije korisnik ga treba oprati i pripremiti na uobičajen higijenski način.',
        },
        {
            component: 'MarkdownBlock',
            markdown:
                '## Što ova stranica ne tvrdi\n\nNe iznosimo tvrdnju o formalnoj certifikaciji prema HACCP sustavu. Ne predstavljamo urod kao proizvod namijenjen konzumaciji bez pranja i uobičajene pripreme. Ne predstavljamo Gredice kao industrijsku preradu hrane niti kao prodaju vlastitog gotovog prehrambenog proizvoda.\n\nAko se poslovni model promijeni tako da uključuje prodaju, preradu, pakiranje, skladištenje ili distribuciju hrane kao tržišnog proizvoda, prije javne objave i rada u takvom modelu potreban je novi pravni i sanitarni pregled.',
        },
        {
            component: 'Faq1',
            tagline: 'Pitanja',
            header: 'Česta pitanja o kvaliteti i sigurnosti',
            description:
                'Najkraći odgovori na pitanja o načinu rada, higijeni i granici javnih tvrdnji.',
            features: [
                {
                    header: 'Komunicirate li formalnu HACCP certifikaciju?',
                    description:
                        'Ne. Trenutno govorimo o internim postupcima temeljenima na dobroj praksi, sljedivosti, evidencijama, korektivnim radnjama i načelima HACCP-a.',
                },
                {
                    header: 'Znači li to da ne pratite sigurnost uroda?',
                    description:
                        'Ne. Pratimo rizike, čistoću, rukovanje, berbu, dostavu i prigovore kako bi se svaka sumnja mogla procijeniti i zapisati.',
                },
                {
                    header: 'Može li se urod jesti bez pranja?',
                    description:
                        'Ne komuniciramo takvu tvrdnju. Urod je svježe ubrano povrće i bilje koje korisnik prije konzumacije treba oprati i pripremiti.',
                },
                {
                    header: 'Što radite ako postoji sumnja na problem?',
                    description:
                        'Urod se zadržava ili izdvaja dok se situacija ne procijeni. Problem se zapisuje, provodi se korektivna radnja i po potrebi se korisniku daje jasna uputa.',
                },
            ],
        },
        {
            component: 'CtaBand',
            header: 'Pitanja o dostavi, pranju ili pripremi uroda?',
            description:
                'Odgovori na najčešća pitanja dostupni su na FAQ stranici, a za konkretan urod možeš se javiti podršci.',
            ctas: [
                {
                    label: 'Otvori česta pitanja',
                    href: '/cesta-pitanja',
                },
                {
                    label: 'Provjeri dostavu',
                    href: '/dostava',
                    secondary: true,
                },
            ],
        },
    ],
};

export const sourceCmsPages = [qualityHarvestSafetyCmsPage];

export function getSourceCmsPageBySlug(slug: string) {
    return sourceCmsPages.find((page) => page.slug === slug) ?? null;
}
