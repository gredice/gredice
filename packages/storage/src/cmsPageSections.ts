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
    allowTagline?: boolean;
    allowMedia?: boolean;
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
        component: 'PageHeader',
        label: 'Zaglavlje stranice',
        description: 'Kompaktno zaglavlje za naslov, uvod i opcionalni vizual.',
        category: 'Zaglavlja',
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
    {
        component: 'Heading1',
        label: 'Hero blok',
        description: 'Veliki uvodni blok s naslovom, opisom i pozivima.',
        category: 'Zaglavlja',
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
        component: 'TextBlock',
        label: 'Tekstualni blok',
        description:
            'Jednostavan tekstualni blok za uvod, objašnjenje ili SEO tekst.',
        category: 'Sadržaj',
        fields: [
            { key: 'tagline', label: 'Tagline', type: 'text' },
            { key: 'header', label: 'Naslov', type: 'text', required: true },
            {
                key: 'description',
                label: 'Opis',
                type: 'textarea',
                rows: 6,
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
        component: 'MarkdownBlock',
        label: 'Markdown',
        description:
            'Sadržaj unesen kao Markdown i prikazan kroz Markdown renderer.',
        category: 'Sadržaj',
        fields: [
            {
                key: 'markdown',
                label: 'Markdown',
                type: 'textarea',
                rows: 14,
                required: true,
                helperText:
                    'Podržava naslove, liste, poveznice i osnovno Markdown formatiranje.',
                placeholder:
                    '## Naslov\n\nOvdje upiši Markdown sadržaj.\n\n- Prva stavka\n- Druga stavka',
            },
        ],
    },
    {
        component: 'HtmlBlock',
        label: 'HTML',
        description:
            'Sadržaj unesen kao HTML i prikazan kroz stilizirani HTML renderer.',
        category: 'Sadržaj',
        fields: [
            {
                key: 'html',
                label: 'HTML',
                type: 'textarea',
                rows: 14,
                required: true,
                helperText:
                    'Prikazuje se kao HTML unutar StyledHtml komponente. Koristi samo provjereni HTML.',
                placeholder:
                    '<h2>Naslov</h2>\n<p>Ovdje upiši HTML sadržaj.</p>',
            },
        ],
    },
    {
        component: 'MediaBlock',
        label: 'Tekst i medij',
        description:
            'Dvostupčani blok s tekstom, pozivima i opcionalnom slikom.',
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
                helperText: 'Opcionalna slika prikazana uz tekst.',
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
        label: 'Dvostupčani popis',
        description: 'Tekstualni uvod uz popis koraka, koristi ili značajki.',
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
        component: 'CardGrid',
        label: 'Kartični grid',
        description: 'Grid kartica za kratke usporedbe, prednosti ili korake.',
        category: 'Sadržaj',
        fields: [
            { key: 'tagline', label: 'Tagline', type: 'text' },
            { key: 'header', label: 'Naslov', type: 'text', required: true },
            { key: 'description', label: 'Opis', type: 'textarea', rows: 4 },
            {
                key: 'features',
                label: 'Kartice',
                type: 'feature-list',
                itemLabel: 'Kartica',
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
        component: 'MetricGrid',
        label: 'Statistike',
        description:
            'Grid istaknutih brojki, vrijednosti ili kratkih podatkovnih sažetaka.',
        category: 'Sadržaj',
        fields: [
            { key: 'tagline', label: 'Tagline', type: 'text' },
            { key: 'header', label: 'Naslov', type: 'text', required: true },
            { key: 'description', label: 'Opis', type: 'textarea', rows: 4 },
            {
                key: 'features',
                label: 'Statistike',
                type: 'feature-list',
                itemLabel: 'Vrijednost',
                required: true,
                allowTagline: true,
                helperText:
                    'Oznaka stavke prikazuje se iznad vrijednosti ako je popunjena.',
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
        component: 'StepList',
        label: 'Koraci',
        description: 'Numerirani koraci za proces, tijek rada ili upute.',
        category: 'Sadržaj',
        fields: [
            { key: 'tagline', label: 'Tagline', type: 'text' },
            { key: 'header', label: 'Naslov', type: 'text', required: true },
            { key: 'description', label: 'Opis', type: 'textarea', rows: 4 },
            {
                key: 'features',
                label: 'Koraci',
                type: 'feature-list',
                itemLabel: 'Korak',
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
        component: 'DataTable',
        label: 'Tablica podataka',
        description:
            'Jednostavna responsivna tablica za pravne, cjenovne ili referentne podatke.',
        category: 'Sadržaj',
        fields: [
            { key: 'tagline', label: 'Tagline', type: 'text' },
            { key: 'header', label: 'Naslov', type: 'text', required: true },
            { key: 'description', label: 'Opis', type: 'textarea', rows: 4 },
            {
                key: 'features',
                label: 'Retci',
                type: 'feature-list',
                itemLabel: 'Naziv',
                required: true,
                allowTagline: true,
                helperText:
                    'Oznaka stavke prikazuje se kao srednji stupac ako je popunjena.',
            },
        ],
    },
    {
        component: 'GalleryGrid',
        label: 'Galerija slika',
        description: 'Grid slika s opcionalnim naslovima i opisima.',
        category: 'Mediji',
        fields: [
            { key: 'tagline', label: 'Tagline', type: 'text' },
            { key: 'header', label: 'Naslov', type: 'text' },
            { key: 'description', label: 'Opis', type: 'textarea', rows: 4 },
            {
                key: 'features',
                label: 'Slike',
                type: 'feature-list',
                itemLabel: 'Slika',
                required: true,
                allowMedia: true,
            },
        ],
    },
    {
        component: 'CalloutBlock',
        label: 'Napomena',
        description: 'Istaknuta informacija, upozorenje ili kratka obavijest.',
        category: 'Sadržaj',
        fields: [
            { key: 'tagline', label: 'Tagline', type: 'text' },
            { key: 'header', label: 'Naslov', type: 'text' },
            {
                key: 'description',
                label: 'Opis',
                type: 'textarea',
                rows: 4,
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
        component: 'EmbedBlock',
        label: 'Ugradbeni prikaz',
        description: 'Responsivni ugradbeni prikaz za mapu, video ili alat.',
        category: 'Mediji',
        fields: [
            { key: 'tagline', label: 'Tagline', type: 'text' },
            { key: 'header', label: 'Naslov', type: 'text' },
            { key: 'description', label: 'Opis', type: 'textarea', rows: 4 },
            {
                key: 'assetUrl',
                label: 'URL prikaza',
                type: 'url',
                required: true,
                helperText:
                    'Koristi provjerene URL-ove za ugradbeni prikaz, npr. mapu ili video.',
            },
            {
                key: 'assetAlt',
                label: 'Naziv prikaza',
                type: 'text',
                placeholder: 'Ugrađeni prikaz',
            },
        ],
    },
    {
        component: 'Faq1',
        label: 'FAQ lista',
        description: 'FAQ blok s pitanjima i odgovorima.',
        category: 'FAQ',
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
        component: 'CtaBand',
        label: 'CTA traka',
        description: 'Istaknuti poziv na sljedeći korak.',
        category: 'Konverzija',
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
                key: 'ctas',
                label: 'Pozivi na akciju',
                type: 'cta-list',
                itemLabel: 'CTA',
                required: true,
                allowSecondary: true,
            },
        ],
    },
    {
        component: 'Footer1',
        label: 'Footer linkovi',
        description: 'Footer s grupama linkova i društvenim poveznicama.',
        category: 'Navigacija',
        fields: [
            {
                key: 'tagline',
                label: 'Naziv organizacije',
                type: 'text',
                placeholder: 'Naziv organizacije',
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
] satisfies CmsPageSectionComponent[];

export const cmsPageSectionPresets = [
    {
        id: 'page-header',
        label: 'Zaglavlje stranice',
        description: 'Naslov i kratki uvod za početak CMS stranice.',
        category: 'Zaglavlja',
        data: {
            component: 'PageHeader',
            header: 'Naslov stranice',
            description:
                'Kratki uvod koji objašnjava što se nalazi na stranici.',
        },
    },
    {
        id: 'hero-intro',
        label: 'Hero uvod',
        description: 'Veliki uvodni blok s jednim ili dva poziva na akciju.',
        category: 'Zaglavlja',
        data: {
            component: 'Heading1',
            tagline: 'Kategorija',
            header: 'Glavni naslov stranice',
            description:
                'Uvodni tekst treba jasno objasniti temu stranice i što korisnik može napraviti sljedeće.',
            ctas: [
                { label: 'Primarna radnja', href: '#' },
                {
                    label: 'Sekundarna radnja',
                    href: '#',
                    secondary: true,
                },
            ],
        },
    },
    {
        id: 'text-block',
        label: 'Tekstualni blok',
        description: 'Neutralni blok za objašnjenje, uvod ili SEO tekst.',
        category: 'Sadržaj',
        data: {
            component: 'TextBlock',
            tagline: 'Kategorija',
            header: 'Naslov tekstualne sekcije',
            description:
                'Dodaj odlomak koji daje kontekst, pojašnjava temu ili povezuje ovu sekciju sa sljedećim dijelom stranice.',
        },
    },
    {
        id: 'markdown-block',
        label: 'Markdown',
        description: 'Markdown sadržaj prikazan kroz standardni renderer.',
        category: 'Sadržaj',
        data: {
            component: 'MarkdownBlock',
            markdown:
                '## Naslov Markdown sekcije\n\nDodaj sadržaj s **formatiranjem**, listama i poveznicama.\n\n- Prva stavka\n- Druga stavka',
        },
    },
    {
        id: 'html-block',
        label: 'HTML',
        description: 'HTML sadržaj prikazan kroz stilizirani HTML renderer.',
        category: 'Sadržaj',
        data: {
            component: 'HtmlBlock',
            html: '<h2>Naslov HTML sekcije</h2>\n<p>Dodaj provjereni HTML sadržaj koji treba renderirati direktno na stranici.</p>',
        },
    },
    {
        id: 'media-block',
        label: 'Tekst i medij',
        description: 'Dvostupčani blok za tekst i sliku ili ilustraciju.',
        category: 'Sadržaj',
        data: {
            component: 'MediaBlock',
            tagline: 'Kategorija',
            header: 'Naslov uz medij',
            description:
                'Opiši vizual, stanje ili koncept koji se prikazuje uz tekstualni sadržaj.',
            assetAlt: 'Opis medija',
        },
    },
    {
        id: 'feature-list',
        label: 'Popis stavki',
        description: 'Tekstualni uvod uz uredive stavke u drugom stupcu.',
        category: 'Sadržaj',
        data: {
            component: 'Feature1',
            tagline: 'Kategorija',
            header: 'Naslov s popisom stavki',
            description:
                'Uvodni odlomak objašnjava zašto su stavke važne i kako ih korisnik treba čitati.',
            features: [
                {
                    header: 'Prva stavka',
                    description: 'Kratko objašnjenje prve stavke.',
                },
                {
                    header: 'Druga stavka',
                    description: 'Kratko objašnjenje druge stavke.',
                },
                {
                    header: 'Treća stavka',
                    description: 'Kratko objašnjenje treće stavke.',
                },
            ],
        },
    },
    {
        id: 'card-grid',
        label: 'Kartični grid',
        description: 'Tri uredive kartice za korake, koristi ili usporedbe.',
        category: 'Sadržaj',
        data: {
            component: 'CardGrid',
            tagline: 'Kategorija',
            header: 'Naslov grupe kartica',
            description:
                'Kratki uvod prije kartica može postaviti kontekst i očekivanja.',
            features: [
                {
                    header: 'Prva kartica',
                    description: 'Sažetak prve kartice.',
                },
                {
                    header: 'Druga kartica',
                    description: 'Sažetak druge kartice.',
                },
                {
                    header: 'Treća kartica',
                    description: 'Sažetak treće kartice.',
                },
            ],
        },
    },
    {
        id: 'metric-grid',
        label: 'Statistike',
        description: 'Istaknute brojke ili vrijednosti u karticama.',
        category: 'Sadržaj',
        data: {
            component: 'MetricGrid',
            tagline: 'Sažetak',
            header: 'Ključne brojke',
            description:
                'Prikaži nekoliko vrijednosti koje korisniku brzo objašnjavaju kontekst.',
            features: [
                {
                    tagline: 'Vrijednost',
                    header: '10.000',
                    description: 'Kratko objašnjenje prve vrijednosti.',
                },
                {
                    tagline: 'Trajanje',
                    header: '30 dana',
                    description: 'Kratko objašnjenje druge vrijednosti.',
                },
                {
                    tagline: 'Status',
                    header: 'Aktivno',
                    description: 'Kratko objašnjenje treće vrijednosti.',
                },
            ],
        },
    },
    {
        id: 'step-list',
        label: 'Koraci',
        description: 'Numerirani koraci za proces ili upute.',
        category: 'Sadržaj',
        data: {
            component: 'StepList',
            tagline: 'Proces',
            header: 'Kako funkcionira',
            description:
                'Kratko objasni proces prije nego korisnik pročita pojedine korake.',
            features: [
                {
                    header: 'Prvi korak',
                    description: 'Objasni što korisnik radi na početku.',
                },
                {
                    header: 'Drugi korak',
                    description: 'Objasni što se događa nakon toga.',
                },
                {
                    header: 'Treći korak',
                    description: 'Objasni završni ishod ili sljedeću radnju.',
                },
            ],
        },
    },
    {
        id: 'data-table',
        label: 'Tablica podataka',
        description: 'Responsivna tablica za reference, cijene ili popise.',
        category: 'Sadržaj',
        data: {
            component: 'DataTable',
            tagline: 'Referenca',
            header: 'Pregled podataka',
            description:
                'Koristi tablicu za podatke koji se lakše uspoređuju po redcima.',
            features: [
                {
                    tagline: 'Kategorija',
                    header: 'Prva stavka',
                    description: 'Opis ili vrijednost prve stavke.',
                },
                {
                    tagline: 'Kategorija',
                    header: 'Druga stavka',
                    description: 'Opis ili vrijednost druge stavke.',
                },
                {
                    tagline: 'Kategorija',
                    header: 'Treća stavka',
                    description: 'Opis ili vrijednost treće stavke.',
                },
            ],
        },
    },
    {
        id: 'gallery-grid',
        label: 'Galerija slika',
        description: 'Grid slika s kratkim opisima.',
        category: 'Mediji',
        data: {
            component: 'GalleryGrid',
            tagline: 'Galerija',
            header: 'Vizualni pregled',
            description:
                'Dodaj slike koje prikazuju stanje, proizvod ili temu.',
            features: [
                {
                    header: 'Prva slika',
                    description: 'Kratki opis prve slike.',
                    assetUrl:
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540"%3E%3Crect width="960" height="540" fill="%23f5f5f5"/%3E%3Crect x="120" y="100" width="720" height="340" rx="28" fill="%23fff" stroke="%23d4d4d8" stroke-width="4"/%3E%3Ccircle cx="340" cy="240" r="72" fill="%23a3a3a3"/%3E%3Cpath d="M176 382 356 284l88 64 104-86 236 120z" fill="%23737373"/%3E%3C/svg%3E',
                    assetDarkUrl:
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540"%3E%3Crect width="960" height="540" fill="%230a0a0a"/%3E%3Crect x="120" y="100" width="720" height="340" rx="28" fill="%23111111" stroke="%23404040" stroke-width="4"/%3E%3Ccircle cx="340" cy="240" r="72" fill="%23737373"/%3E%3Cpath d="M176 382 356 284l88 64 104-86 236 120z" fill="%23a3a3a3"/%3E%3C/svg%3E',
                    assetAlt: 'Prikaz prve slike',
                },
                {
                    header: 'Druga slika',
                    description: 'Kratki opis druge slike.',
                    assetUrl:
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540"%3E%3Crect width="960" height="540" fill="%23f5f5f5"/%3E%3Crect x="120" y="100" width="720" height="340" rx="28" fill="%23fff" stroke="%23d4d4d8" stroke-width="4"/%3E%3Crect x="190" y="160" width="580" height="38" rx="19" fill="%23101828"/%3E%3Crect x="190" y="234" width="420" height="28" rx="14" fill="%23737373"/%3E%3Crect x="190" y="296" width="500" height="28" rx="14" fill="%23a3a3a3"/%3E%3C/svg%3E',
                    assetDarkUrl:
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540"%3E%3Crect width="960" height="540" fill="%230a0a0a"/%3E%3Crect x="120" y="100" width="720" height="340" rx="28" fill="%23111111" stroke="%23404040" stroke-width="4"/%3E%3Crect x="190" y="160" width="580" height="38" rx="19" fill="%23f5f5f5"/%3E%3Crect x="190" y="234" width="420" height="28" rx="14" fill="%23a3a3a3"/%3E%3Crect x="190" y="296" width="500" height="28" rx="14" fill="%23737373"/%3E%3C/svg%3E',
                    assetAlt: 'Prikaz druge slike',
                },
            ],
        },
    },
    {
        id: 'callout-block',
        label: 'Napomena',
        description: 'Istaknuta informacija ili upozorenje.',
        category: 'Sadržaj',
        data: {
            component: 'CalloutBlock',
            tagline: 'Napomena',
            header: 'Važna informacija',
            description:
                'Dodaj kratku informaciju koju korisnik treba primijetiti tijekom čitanja stranice.',
        },
    },
    {
        id: 'embed-block',
        label: 'Ugradbeni prikaz',
        description: 'Ugrađena mapa, video ili drugi provjereni prikaz.',
        category: 'Mediji',
        data: {
            component: 'EmbedBlock',
            tagline: 'Prikaz',
            header: 'Ugrađeni sadržaj',
            description:
                'Dodaj mapu, video ili drugi vanjski prikaz koji pomaže objasniti sadržaj.',
            assetUrl: 'https://www.openstreetmap.org/export/embed.html',
            assetAlt: 'Ugrađeni prikaz',
        },
    },
    {
        id: 'faq-list',
        label: 'FAQ lista',
        description: 'Početni FAQ blok s tri neutralna pitanja.',
        category: 'FAQ',
        data: {
            component: 'Faq1',
            tagline: 'Pitanja',
            header: 'Česta pitanja',
            description:
                'Odgovori na najvažnija pitanja vezana uz ovu stranicu.',
            features: [
                {
                    header: 'Prvo pitanje?',
                    description: 'Dodaj kratak i konkretan odgovor.',
                },
                {
                    header: 'Drugo pitanje?',
                    description: 'Dodaj kratak i konkretan odgovor.',
                },
                {
                    header: 'Treće pitanje?',
                    description: 'Dodaj kratak i konkretan odgovor.',
                },
            ],
        },
    },
    {
        id: 'cta-band',
        label: 'CTA traka',
        description: 'Istaknuti blok za usmjeravanje na sljedeću radnju.',
        category: 'Konverzija',
        data: {
            component: 'CtaBand',
            tagline: 'Sljedeći korak',
            header: 'Naslov poziva na akciju',
            description:
                'Objasni što korisnik dobiva nakon klika i zašto je to logičan sljedeći korak.',
            ctas: [
                { label: 'Primarna radnja', href: '#' },
                {
                    label: 'Sekundarna radnja',
                    href: '#',
                    secondary: true,
                },
            ],
        },
    },
    {
        id: 'footer-link-groups',
        label: 'Footer linkovi',
        description: 'Generičke grupe linkova bez unaprijed zadanih ruta.',
        category: 'Navigacija',
        data: {
            component: 'Footer1',
            tagline: 'Naziv organizacije',
            features: [
                {
                    header: 'Grupa linkova',
                    ctas: [
                        { label: 'Prva poveznica', href: '#' },
                        { label: 'Druga poveznica', href: '#' },
                    ],
                },
                {
                    header: 'Dodatni linkovi',
                    ctas: [
                        { label: 'Treća poveznica', href: '#' },
                        { label: 'Četvrta poveznica', href: '#' },
                    ],
                },
            ],
            ctas: [
                {
                    label: 'Društvena poveznica',
                    href: '#',
                    iconName: 'link',
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
