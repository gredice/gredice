export type CmsPageTextSectionField = {
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'url';
    rows?: number;
    required?: boolean;
    helperText?: string;
    placeholder?: string;
};

export type CmsPageCtaListSectionField = {
    key: string;
    label: string;
    type: 'cta-list';
    itemLabel: string;
    required?: boolean;
    helperText?: string;
    allowIcon?: boolean;
    allowSecondary?: boolean;
};

export type CmsPageFeatureListSectionField = {
    key: string;
    label: string;
    type: 'feature-list';
    itemLabel: string;
    required?: boolean;
    helperText?: string;
    allowCtas?: boolean;
};

export type CmsPageSectionField =
    | CmsPageTextSectionField
    | CmsPageCtaListSectionField
    | CmsPageFeatureListSectionField;

export type CmsPageSectionComponent = {
    component: string;
    label: string;
    description: string;
    category: string;
    fields: CmsPageSectionField[];
    isCustom?: boolean;
};

export type CmsPageSectionPreset = {
    id: string;
    label: string;
    description: string;
    category: string;
    data: {
        component: string;
        [key: string]: unknown;
    };
};

export const cmsPageSectionComponents = [
    {
        component: 'Heading1',
        label: 'Heading1',
        description: 'Veliki uvodni blok s naslovom, opisom i pozivima.',
        category: 'Hero i uvod',
        fields: [
            { key: 'tagline', label: 'Tagline', type: 'text' },
            { key: 'header', label: 'Naslov', type: 'text', required: true },
            {
                key: 'description',
                label: 'Opis',
                type: 'textarea',
                rows: 4,
                required: true,
            },
            {
                key: 'assetUrl',
                label: 'URL slike',
                type: 'url',
                helperText: 'Opcionalna slika prikazana uz sekciju.',
            },
            { key: 'assetAlt', label: 'Opis slike', type: 'text' },
            {
                key: 'ctas',
                label: 'Pozivi na akciju',
                type: 'cta-list',
                itemLabel: 'CTA',
                allowSecondary: true,
            },
        ],
    },
    {
        component: 'Feature1',
        label: 'Feature1',
        description: 'Dvodijelni blok za opis koristi, koraka ili značajki.',
        category: 'Sadržaj',
        fields: [
            { key: 'tagline', label: 'Tagline', type: 'text' },
            { key: 'header', label: 'Naslov', type: 'text', required: true },
            {
                key: 'description',
                label: 'Opis',
                type: 'textarea',
                rows: 4,
                required: true,
            },
            {
                key: 'assetUrl',
                label: 'URL slike',
                type: 'url',
                helperText: 'Opcionalna slika prikazana u lijevom stupcu.',
            },
            { key: 'assetAlt', label: 'Opis slike', type: 'text' },
            {
                key: 'features',
                label: 'Stavke',
                type: 'feature-list',
                itemLabel: 'Stavka',
            },
            {
                key: 'ctas',
                label: 'Pozivi na akciju',
                type: 'cta-list',
                itemLabel: 'CTA',
                allowSecondary: true,
            },
        ],
    },
    {
        component: 'Faq1',
        label: 'Faq1',
        description: 'FAQ blok s pitanjima i odgovorima.',
        category: 'Podrška',
        fields: [
            { key: 'tagline', label: 'Tagline', type: 'text' },
            { key: 'header', label: 'Naslov', type: 'text', required: true },
            {
                key: 'description',
                label: 'Opis',
                type: 'textarea',
                rows: 4,
                required: true,
            },
            {
                key: 'features',
                label: 'Pitanja i odgovori',
                type: 'feature-list',
                itemLabel: 'Pitanje',
                required: true,
            },
            {
                key: 'ctas',
                label: 'Pozivi na akciju',
                type: 'cta-list',
                itemLabel: 'CTA',
                allowSecondary: true,
            },
        ],
    },
    {
        component: 'Footer1',
        label: 'Footer1',
        description: 'Footer s grupama linkova i društvenim poveznicama.',
        category: 'Navigacija',
        fields: [
            {
                key: 'tagline',
                label: 'Naziv tvrtke',
                type: 'text',
                placeholder: 'Gredice d.o.o',
            },
            {
                key: 'features',
                label: 'Grupe linkova',
                type: 'feature-list',
                itemLabel: 'Grupa',
                allowCtas: true,
            },
            {
                key: 'ctas',
                label: 'Društvene poveznice',
                type: 'cta-list',
                itemLabel: 'Poveznica',
                allowIcon: true,
            },
        ],
    },
    {
        component: 'PageHeader',
        label: 'Page header',
        description: 'Standardno zaglavlje CMS stranice.',
        category: 'Hero i uvod',
        isCustom: true,
        fields: [
            { key: 'header', label: 'Naslov', type: 'text', required: true },
            { key: 'description', label: 'Opis', type: 'textarea', rows: 4 },
            {
                key: 'assetUrl',
                label: 'URL slike',
                type: 'url',
                helperText: 'Opcionalna vizualna kartica u zaglavlju.',
            },
            { key: 'assetAlt', label: 'Opis slike', type: 'text' },
        ],
    },
] satisfies CmsPageSectionComponent[];

export const cmsPageSectionPresets = [
    {
        id: 'page-header-basic',
        label: 'Osnovno zaglavlje',
        description: 'Naslov i uvodni opis za standardnu CMS stranicu.',
        category: 'Struktura',
        data: {
            component: 'PageHeader',
            header: 'Naslov stranice',
            description:
                'Kratki uvod koji objašnjava što se nalazi na stranici.',
        },
    },
    {
        id: 'page-header-visual',
        label: 'Zaglavlje s vizualom',
        description:
            'Zaglavlje koje može pratiti stvarna slika ili ilustracija.',
        category: 'Struktura',
        data: {
            component: 'PageHeader',
            header: 'Suncokreti',
            description:
                'Sakupljaj i koristi suncokrete za uređenje vrta ili brigu o svojim biljkama.',
            assetUrl: 'https://cdn.gredice.com/sunflower-large.svg',
            assetAlt: 'Suncokret',
        },
    },
    {
        id: 'home-main-offer',
        label: 'Početna - glavna ponuda',
        description: 'Uvodni Gredice blok iz javne početne stranice.',
        category: 'Početna',
        data: {
            component: 'Feature1',
            tagline: 'Vrt po tvom',
            header: 'Klikneš, mi sadimo - ti uživaš',
            description:
                'Par klikova i tvoje gredice su spremne. Odaberi povrće, mi ga posadimo, a ti ubrzo uživaš u plodovima svog novog vrta.',
            ctas: [
                { label: 'Složi gredicu', href: '/podignuta-gredica' },
                {
                    label: 'Pogledaj biljke',
                    href: '/biljke',
                    secondary: true,
                },
            ],
        },
    },
    {
        id: 'home-three-steps',
        label: 'Početna - tri koraka',
        description: 'Zasadi, održavaj i uberi kao uredive stavke.',
        category: 'Početna',
        data: {
            component: 'Feature1',
            tagline: 'Kako radi',
            header: 'Odaberi, prati i uživaj u svom vrtu',
            description:
                'Gredice povezuju aplikaciju, lokalni OPG i stvarne vrtne radnje.',
            features: [
                {
                    header: 'Zasadi',
                    description:
                        'Odaberi svoju kombinaciju povrća u aplikaciji i složi svoju gredicu.',
                },
                {
                    header: 'Održavaj',
                    description:
                        'Prati stanje gredica, naruči radnje i dobivaj obavijesti o vrtu.',
                },
                {
                    header: 'Uberi i uživaj',
                    description:
                        'Kad poželiš, zatraži branje i isporuku plodova iz svog vrta.',
                },
            ],
        },
    },
    {
        id: 'raised-bed-intro',
        label: 'Podignuta gredica',
        description: 'Uvod za stranicu o podignutim gredicama.',
        category: 'Proizvod',
        data: {
            component: 'Heading1',
            tagline: 'Modularni vrt',
            header: 'Podignuta gredica za stvarni vrt',
            description:
                'Predstavi što korisnik dobiva, kako se gredica koristi i koje odluke može donijeti prije kupnje.',
            ctas: [{ label: 'Saznaj više', href: '/podignuta-gredica' }],
        },
    },
    {
        id: 'plants-directory-intro',
        label: 'Biljke - uvod',
        description: 'Uvodni blok za katalog biljaka i sorti.',
        category: 'Katalog',
        data: {
            component: 'Feature1',
            tagline: 'Katalog',
            header: 'Biljke koje možeš posaditi u gredice',
            description:
                'Koristi ovaj blok za uvod u biljke, sorte, sezonalnost i odluke pri sadnji.',
            ctas: [{ label: 'Pogledaj biljke', href: '/biljke' }],
        },
    },
    {
        id: 'operations-intro',
        label: 'Radnje - uvod',
        description: 'Blok za objašnjenje vrtnih radnji i održavanja.',
        category: 'Katalog',
        data: {
            component: 'Feature1',
            tagline: 'Održavanje',
            header: 'Radnje koje održavaju vrt urednim',
            description:
                'Objasni što korisnik može zatražiti, kada se radnje izvode i kako se prate u aplikaciji.',
            ctas: [{ label: 'Pogledaj radnje', href: '/radnje' }],
        },
    },
    {
        id: 'support-faq',
        label: 'FAQ blok',
        description: 'Česta pitanja s tri početne stavke.',
        category: 'Podrška',
        data: {
            component: 'Faq1',
            tagline: 'Pitanja',
            header: 'Česta pitanja',
            description:
                'Sažmi najvažnije odgovore prije nego korisnik kontaktira podršku.',
            features: [
                {
                    header: 'Kako započeti?',
                    description:
                        'Uredi ovaj odgovor prema konkretnoj stranici i korisničkom koraku.',
                },
                {
                    header: 'Što se događa nakon narudžbe?',
                    description:
                        'Objasni sljedeći korak, očekivanja i gdje korisnik vidi status.',
                },
                {
                    header: 'Koga mogu kontaktirati?',
                    description:
                        'Dodaj kanal podrške koji već postoji u javnom iskustvu.',
                },
            ],
        },
    },
    {
        id: 'sunflowers-faq',
        label: 'Suncokreti FAQ',
        description: 'Postojeći FAQ uzorak za stranicu o suncokretima.',
        category: 'Podrška',
        data: {
            component: 'Faq1',
            header: 'Sve što trebaš znati o suncokretima',
            description:
                'Suncokreti ne dolaze samo u jednoj boji i veličini. Postoje različite vrste suncokreta, a svaka od njih ima svoje karakteristike i boje.',
            features: [
                {
                    header: 'Što su suncokreti?',
                    description:
                        'Sakupljaj i koristi suncokrete za uređenje i dekoraciju vrta ili kupnju i brigu o svojim biljkama.',
                },
                {
                    header: 'Kako skupljam suncokrete?',
                    description:
                        'Suncokrete dobivaš kroz aktivnost u vrtu, odrađene radnje i kupnje u aplikaciji.',
                },
                {
                    header: 'Za što se mogu koristiti suncokreti?',
                    description:
                        'Suncokrete možeš koristiti za ukrašavanje vrta te brigu o gredicama i biljkama.',
                },
            ],
        },
    },
    {
        id: 'seo-content-block',
        label: 'SEO tekstualni blok',
        description: 'Dugi opis s podstavkama za javne sadržajne stranice.',
        category: 'SEO',
        data: {
            component: 'Feature1',
            tagline: 'Vodič',
            header: 'Naslov koji jasno opisuje temu stranice',
            description:
                'Uvodni odlomak treba objasniti komu je stranica namijenjena, što korisnik može odlučiti i što je sljedeći korak.',
            features: [
                {
                    header: 'Korisna odluka',
                    description:
                        'Dodaj konkretan kriterij koji pomaže korisniku usporediti opcije.',
                },
                {
                    header: 'Praktičan sljedeći korak',
                    description:
                        'Poveži sadržaj sa stvarnim Gredice tokom rada ili javnom rutom.',
                },
            ],
        },
    },
    {
        id: 'cta-primary',
        label: 'CTA blok',
        description: 'Jednostavan blok za usmjeravanje na sljedeću radnju.',
        category: 'Konverzija',
        data: {
            component: 'Heading1',
            tagline: 'Sljedeći korak',
            header: 'Spremni za planiranje vrta?',
            description:
                'Kratko objasni što korisnik dobiva klikom na primarni poziv.',
            ctas: [
                { label: 'Kreni', href: '/podignuta-gredica' },
                { label: 'Kontakt', href: '/kontakt', secondary: true },
            ],
        },
    },
    {
        id: 'contact-block',
        label: 'Kontakt blok',
        description: 'Kontakt i podrška s primarnim javnim rutama.',
        category: 'Podrška',
        data: {
            component: 'Feature1',
            tagline: 'Podrška',
            header: 'Trebaš pomoć oko Gredica?',
            description:
                'Usmjeri korisnika prema kontaktu, čestim pitanjima ili relevantnom javnom sadržaju.',
            ctas: [
                { label: 'Kontaktiraj nas', href: '/kontakt' },
                {
                    label: 'Česta pitanja',
                    href: '/cesta-pitanja',
                    secondary: true,
                },
            ],
        },
    },
    {
        id: 'footer-main-links',
        label: 'Footer linkovi',
        description: 'Glavne javne grupe linkova iz Gredice footera.',
        category: 'Navigacija',
        data: {
            component: 'Footer1',
            tagline: 'Gredice d.o.o',
            features: [
                {
                    header: 'Informacije',
                    ctas: [
                        { label: 'Dostava', href: '/dostava' },
                        { label: 'Cjenik', href: '/cjenik' },
                        { label: 'Česta pitanja', href: '/cesta-pitanja' },
                        { label: 'Kontaktiraj nas', href: '/kontakt' },
                    ],
                },
                {
                    header: 'Aplikacija',
                    ctas: [
                        {
                            label: 'Podignuta gredica',
                            href: '/podignuta-gredica',
                        },
                        { label: 'Sjetva biljaka', href: '/sjetva' },
                        { label: 'Biljke', href: '/biljke' },
                        { label: 'Radnje', href: '/radnje' },
                    ],
                },
                {
                    header: 'Više',
                    ctas: [
                        {
                            label: 'Politika privatnosti',
                            href: '/legalno/politika-privatnosti',
                        },
                        {
                            label: 'Uvjeti korištenja',
                            href: '/legalno/uvjeti-koristenja',
                        },
                        { label: 'Natječaji', href: '/legalno/natjecaji' },
                    ],
                },
            ],
            ctas: [
                {
                    label: 'Instagram',
                    href: 'https://gredice.link/ig',
                    iconName: 'instagram',
                },
                {
                    label: 'Facebook',
                    href: 'https://gredice.link/fb',
                    iconName: 'facebook',
                },
                {
                    label: 'GitHub',
                    href: 'https://github.com/gredice',
                    iconName: 'github',
                },
            ],
        },
    },
] satisfies CmsPageSectionPreset[];

export const supportedCmsPageSectionComponents = new Set(
    cmsPageSectionComponents.map((section) => section.component),
);

export function getCmsPageSectionComponent(component: string) {
    return cmsPageSectionComponents.find(
        (item) => item.component === component,
    );
}
