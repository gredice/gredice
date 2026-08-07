import type {
    CmsPageRenderMaxWidth,
    CmsPageRenderMode,
    SectionData,
} from '@gredice/ui/cms';

export {
    COMPANION_PLANTING_LAST_REVIEWED,
    COMPANION_PLANTING_PATH,
    COMPANION_PLANTING_SLUG,
    QUALITY_HARVEST_SAFETY_LAST_REVIEWED,
    QUALITY_HARVEST_SAFETY_PATH,
    QUALITY_HARVEST_SAFETY_SLUG,
} from '../../src/publicPagePaths.ts';

import {
    COMPANION_PLANTING_LAST_REVIEWED,
    COMPANION_PLANTING_PATH,
    COMPANION_PLANTING_SLUG,
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
    metaImagePoiX: number | null;
    metaImagePoiY: number | null;
    seoImageUrl: string | null;
    canonicalPath: string;
    noIndex: false;
    updatedAt: string;
};

export const companionPlantingCmsPage: SourceCmsPage = {
    slug: COMPANION_PLANTING_SLUG,
    title: 'Biljni susjedi',
    contentKind: 'page',
    category: null,
    tags: ['Biljke', 'Planiranje gredice', 'Biljni susjedi'],
    state: 'published',
    publishedAt: `${COMPANION_PLANTING_LAST_REVIEWED}T00:00:00.000Z`,
    updatedAt: `${COMPANION_PLANTING_LAST_REVIEWED}T00:00:00.000Z`,
    metaTitle: 'Biljni susjedi i companion planting',
    metaDescription:
        'Što je companion planting, kako čitati dobre i loše biljne susjede te kako ih koristiti pri planiranju gredice.',
    metaImageUrl: null,
    metaImagePoiX: null,
    metaImagePoiY: null,
    seoImageUrl: null,
    canonicalPath: COMPANION_PLANTING_PATH,
    noIndex: false,
    renderMode: 'container',
    renderMaxWidth: 'lg',
    content: [
        {
            component: 'PageHeader',
            header: 'Biljni susjedi',
            description:
                'Companion planting, odnosno sadnja biljnih susjeda, način je planiranja gredice u kojem se biljke slažu prema tome kako mogu pomagati, smetati ili neutralno rasti jedna uz drugu.',
        },
        {
            component: 'TextBlock',
            tagline: 'Osnove',
            header: 'Što je companion planting?',
            description:
                'Kod planiranja gredice nije važno samo koliko mjesta biljka zauzima. Gledamo i vrijeme rasta, visinu, sjenu, mirise, oprašivače, potrebe za hranivima te moguće prenošenje bolesti ili štetnika. Dobar susjed može bolje iskoristiti prostor, privući korisne kukce, zbuniti neke štetnike ili jednostavno dobro pristajati u rasporedu.',
        },
        {
            component: 'Feature1',
            tagline: 'Kako čitati preporuke',
            header: 'Tri signala, jedna odluka',
            description:
                'Biljni susjedi su pomoć pri izboru i razmještaju biljaka. Najkorisniji su kada ih kombiniraš s razmakom sadnje, svjetlom, vodom i sezonom.',
            features: [
                {
                    header: 'Dobri susjedi',
                    description:
                        'Biljke koje se prema dostupnim izvorima i praktičnom planiranju često dobro slažu u blizini. To ne znači da moraju biti odmah jedna uz drugu, nego da ih vrijedi razmotriti u istom dijelu gredice.',
                },
                {
                    header: 'Izbjegavati blizinu',
                    description:
                        'Biljke kod kojih je bolje ostaviti razmak ili odabrati drugo polje. Razlog može biti natjecanje za prostor i hraniva, različit ritam rasta ili veći rizik od štetnika i bolesti.',
                },
                {
                    header: 'Neutralne kombinacije',
                    description:
                        'Ako biljke nisu označene kao dobri ili loši susjedi, to obično znači da nemamo dovoljno jasan signal. Tada prednost imaju sezona, razmak, dostupnost i vlastite želje.',
                },
                {
                    header: 'Kontekst gredice',
                    description:
                        'Ista kombinacija može se ponašati drugačije u sjeni, na jakom suncu, u zbijenom rasporedu ili uz drugačije zalijevanje. Biljni susjedi zato ne zamjenjuju promatranje gredice.',
                },
            ],
        },
        {
            component: 'CalloutBlock',
            tagline: 'Napomena',
            header: 'Nije strogo pravilo niti jamstvo prinosa',
            description:
                'Preporuke biljnih susjeda koristimo kao signal za planiranje, a ne kao obećanje da će kombinacija uvijek uspjeti. Tlo, vrijeme, njega, sorta i stanje biljke i dalje imaju veliku ulogu.',
        },
        {
            component: 'MarkdownBlock',
            markdown:
                '## Primjeri u praksi\n\n- **Rajčica i bosiljak** često se prikazuju kao dobri susjedi jer se dobro uklapaju u isti ljetni ritam gredice.\n- **Mrkva i luk** mogu biti korisna kombinacija kada želiš miješati korjenasto povrće i lukovičaste biljke uz dovoljno razmaka.\n- **Komorač** se često odvaja od drugih kultura, pa ga u Gredicama prikazujemo kao biljku za oprezniji raspored.\n\n## Odakle dolaze podaci\n\nPodatke o biljnim susjedima slažemo iz javno dostupnih savjetodavnih tablica i izvora, zatim ih mapiramo na biljke koje postoje u Gredicama. Kada se izvori razilaze, radije ne prikazujemo par nego da ostavimo dojam lažne sigurnosti.\n\nKorisni izvori za kontekst:\n\n- [UF/IFAS Manatee County Extension companion planting chart](https://www.growables.org/informationVeg/documents/CompanionGuideUF.pdf)\n- [Virginia Cooperative Extension SPES-620P companion planting chart](https://www.pubs.ext.vt.edu/content/dam/pubs_ext_vt_edu/spes/spes-620/SPES-620.pdf)\n- [West Virginia University Extension companion planting guidance](https://extension.wvu.edu/lawn-gardening-pests/gardening/garden-management/companion-planting)\n- [University of Minnesota Extension companion planting context](https://extension.umn.edu/planting-and-growing-guides/companion-planting-home-gardens)',
        },
        {
            component: 'Faq1',
            tagline: 'Pitanja',
            header: 'Česta pitanja o biljnim susjedima',
            description:
                'Kratki odgovori za planiranje gredice bez pretjerivanja s pravilima.',
            features: [
                {
                    header: 'Moram li uvijek saditi dobre susjede zajedno?',
                    description:
                        'Ne. Dobar susjed je prijedlog koji može pomoći pri rasporedu. Ako biljci više odgovara drugo mjesto zbog sunca, razmaka ili termina sadnje, taj kontekst ima prednost.',
                },
                {
                    header: 'Znači li loš susjed da biljke nikako ne smiju biti blizu?',
                    description:
                        'Ne nužno. To je signal za oprez. U maloj gredici često je dovoljno ostaviti razmak, ne saditi ih u isto polje ili ih razdvojiti drugom kulturom.',
                },
                {
                    header: 'Zašto neke biljke nemaju prikazane susjede?',
                    description:
                        'Za neke biljke nemamo dovoljno pouzdano mapirane podatke ili se izvori previše razilaze. Tada je bolje prikazati manje informacija nego sigurnije zvučati nego što podaci dopuštaju.',
                },
                {
                    header: 'Kako Gredice koriste ove podatke?',
                    description:
                        'Prikazujemo dobre i loše susjede na javnim stranicama biljaka te ih koristimo kao signal u vrtu kada biraš što posaditi pokraj postojećih biljaka.',
                },
            ],
        },
        {
            component: 'CtaBand',
            header: 'Planiraš što posaditi sljedeće?',
            description:
                'Otvori katalog biljaka, provjeri dobre i loše susjede i složi gredicu prema sezoni, prostoru i vlastitom ukusu.',
            ctas: [
                {
                    label: 'Pregledaj biljke',
                    href: '/biljke',
                },
                {
                    label: 'Vodič za prvu gredicu',
                    href: '/vodic-za-prvu-gredicu',
                    secondary: true,
                },
            ],
        },
    ],
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
    metaImagePoiX: null,
    metaImagePoiY: null,
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
            header: 'Urod ostaje tvoj urod',
            description:
                'Gredice pružaju uslugu planiranja, uzgoja, njege, berbe i dostave tvojeg uroda. U trenutnom modelu urod ne predstavljamo kao vlastiti gotov prehrambeni proizvod, nego kao svježe ubrano povrće i bilje koje preuzimaš i pripremaš za vlastitu upotrebu.',
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
                        'Povezivanje računa, gredice, sezone, berbe i dostave kako bi se u slučaju pitanja moglo provjeriti što se dogodilo.',
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
                'Urod je svježe ubrano povrće i bilje. Prije konzumacije treba ga oprati i pripremiti na uobičajen higijenski način.',
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
                    header: 'Postoji li formalna HACCP certifikacija?',
                    description:
                        'Ne. Trenutno govorimo o internim postupcima temeljenima na dobroj praksi, sljedivosti, evidencijama, korektivnim radnjama i načelima HACCP-a.',
                },
                {
                    header: 'Znači li to da se sigurnost uroda ne prati?',
                    description:
                        'Ne. Pratimo rizike, čistoću, rukovanje, berbu, dostavu i prigovore kako bi se svaka sumnja mogla procijeniti i zapisati.',
                },
                {
                    header: 'Može li se urod jesti bez pranja?',
                    description:
                        'Ne komuniciramo takvu tvrdnju. Urod je svježe ubrano povrće i bilje koje prije konzumacije treba oprati i pripremiti.',
                },
                {
                    header: 'Što radite ako postoji sumnja na problem?',
                    description:
                        'Urod se zadržava ili izdvaja dok se situacija ne procijeni. Problem se zapisuje, provodi se korektivna radnja i po potrebi šaljemo jasnu uputu.',
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

export const sourceCmsPages = [
    companionPlantingCmsPage,
    qualityHarvestSafetyCmsPage,
];

export function getSourceCmsPageBySlug(slug: string) {
    return sourceCmsPages.find((page) => page.slug === slug) ?? null;
}
