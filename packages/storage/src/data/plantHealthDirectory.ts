export const plantHealthDirectorySources = {
    umnTomatoLeafSpots: {
        label: 'University of Minnesota Extension tomato leaf spot diseases',
        url: 'https://extension.umn.edu/plant-diseases/tomato-leaf-spot-diseases',
    },
    umnEarlyBlightTomatoPotato: {
        label: 'University of Minnesota Extension early blight in tomato and potato',
        url: 'https://extension.umn.edu/node/2681',
    },
    ucIpmPowderyMildewVegetables: {
        label: 'UC IPM Powdery Mildew on Vegetables',
        url: 'https://ipm.ucanr.edu/m/pn7406-0.html',
    },
    ucIpmAphids: {
        label: 'UC IPM Aphids Pest Notes',
        url: 'https://ipm.ucanr.edu/home-and-landscape/aphids',
    },
    umnSlugs: {
        label: 'University of Minnesota Extension slugs in home gardens',
        url: 'https://extension.umn.edu/yard-and-garden-insects/slugs',
    },
    ucIpmWhiteflies: {
        label: 'UC IPM Whiteflies Pest Notes',
        url: 'https://ipm.ucanr.edu/home-and-landscape/whiteflies/pest-notes',
    },
} as const;

export type PlantHealthDirectorySource =
    keyof typeof plantHealthDirectorySources;

export type PlantHealthDirectoryIssueKind = 'disease' | 'pest';

export type PlantHealthDirectoryIssue = {
    kind: PlantHealthDirectoryIssueKind;
    name: string;
    label?: string;
    shortDescription: string;
    description: string;
    symptoms: string;
    favorableConditions: string;
    severity: string;
    affectedPlants: string[];
    operations?: {
        prevention?: string[];
        reduction?: string[];
        alleviation?: string[];
    };
    sources: PlantHealthDirectorySource[];
    reviewNotes?: string[];
};

export const plantHealthDirectoryDataset: PlantHealthDirectoryIssue[] = [
    {
        kind: 'disease',
        name: 'Rana plamenjača rajčice',
        shortDescription:
            'Gljivična bolest rajčice koja najčešće počinje na starijem donjem lišću tamnim pjegama s koncentričnim krugovima.',
        description:
            'Rana plamenjača može zahvatiti listove, stabljike i plodove rajčice. U maloj gredici najvažnije je rano uočiti pjege, smanjiti zadržavanje vlage na listu i ukloniti zaraženo lišće prije jačeg širenja.',
        symptoms:
            'Na starijem lišću blizu tla nastaju tamne okrugle pjege. Veće pjege često imaju koncentrične prstenove, okolno tkivo žuti, a jako zaraženi listovi posmeđe i otpadaju ili ostaju suhi na biljci.',
        favorableConditions:
            'Bolesti lista rajčice lakše se šire kada su listovi mokri, uz rosu, prskanje tla po donjem lišću, visoku relativnu vlagu i umjereno toplo vrijeme.',
        severity:
            'Srednje do visoko: rana reakcija obično ograničava štetu, ali jači napad može uzrokovati defolijaciju i ožegotine plodova.',
        affectedPlants: ['Rajčica'],
        operations: {
            prevention: ['applyTomatoResiliencePreparation'],
            reduction: ['hygiene-pruning'],
            alleviation: ['plantRemoval'],
        },
        sources: ['umnEarlyBlightTomatoPotato', 'umnTomatoLeafSpots'],
    },
    {
        kind: 'disease',
        name: 'Pepelnica povrća',
        shortDescription:
            'Skupina gljivičnih bolesti koje stvaraju bijele praškaste prevlake ili svijetle pjege na listovima više vrsta povrća.',
        description:
            'Pepelnica se razlikuje po uzročniku i biljci domaćinu, ali se u gredici najčešće prepoznaje po bijelim praškastim pjegama na listu. Kod jačeg napada listovi slabe, žute ili odumiru pa biljka teže dozrijeva i daje slabiji urod.',
        symptoms:
            'Bijele praškaste pjege šire se po gornjoj ili donjoj strani lista, mladim izbojima, a ponekad i cvjetovima ili plodovima. Na rajčici i paprici simptomi mogu izgledati kao žute pjege s manje vidljive bijele prevlake.',
        favorableConditions:
            'Pepelnica se može razvijati bez dugotrajnog kvašenja lista. Česta je u toplim uvjetima, na zasjenjenim ili gustim biljkama i kada je strujanje zraka slabo.',
        severity:
            'Srednje: često počinje kasnije u sezoni, ali kod osjetljivih biljaka i gustog sklopa može brzo oslabiti lisnu masu.',
        affectedPlants: [
            'Artičoka',
            'Grah',
            'Cikla',
            'Mrkva',
            'Krastavac',
            'Patlidžan',
            'Salata',
            'Dinja',
            'Grašak',
            'Paprika',
            'Rajčica',
            'Repa',
            'Rotkvica',
            'Tikva',
            'Tikvice',
        ],
        operations: {
            reduction: ['hygiene-pruning'],
        },
        sources: ['ucIpmPowderyMildewVegetables'],
        reviewNotes: [
            'Host list is limited to current published Gredice plants explicitly covered by the UC IPM vegetable host list.',
        ],
    },
    {
        kind: 'pest',
        name: 'Lisne uši',
        shortDescription:
            'Sitni mekani kukci koji sišu biljne sokove, često na mladim izbojima i naličju listova.',
        description:
            'Lisne uši mogu se pojaviti u skupinama na mladim dijelovima biljke. Osim izravnog sisanja sokova, izlučuju ljepljivu mednu rosu i mogu prenositi biljne viruse. U gredici je korisno redovito pregledavati mlade izboje i reagirati dok je napad lokaliziran.',
        symptoms:
            'Uvijanje mladih listova, žućenje, zastoj rasta, ljepljiva medna rosa, crna čađava prevlaka na mednoj rosi i vidljive kolonije sitnih zelenih, crnih ili žućkastih uši.',
        favorableConditions:
            'Napadi se često razvijaju na mladom mekanom rastu i blizu drugih zaraženih biljaka. Mravi mogu štititi lisne uši zbog medne rose.',
        severity:
            'Nisko do srednje kod ranog uočavanja; visoko na mladim biljkama ili kada se napad ne prati.',
        affectedPlants: [
            'Bosiljak',
            'Brokula',
            'Cvjetača',
            'Čili',
            'Grah',
            'Grašak',
            'Jagoda',
            'Kelj',
            'Kelj pupčar',
            'Krastavac',
            'Kupus',
            'Mahuna',
            'Paprika',
            'Rajčica',
            'Salata',
        ],
        operations: {
            prevention: ['applyPestProtectionPreparation'],
            reduction: ['rinsePestsFromPlant'],
            alleviation: ['applyPestProtectionPreparation'],
        },
        sources: ['ucIpmAphids'],
    },
    {
        kind: 'pest',
        name: 'Puževi',
        shortDescription:
            'Puževi i golaći hrane se noću ili za vlažnog vremena te ostavljaju nepravilne rupe i sluzave tragove.',
        description:
            'Puževi vole hladna, vlažna i zasjenjena mjesta. Najviše štete rade na mladim biljkama, nježnom lišću, jagodama i biljkama uz gustu vegetaciju ili zaklon. Trag sluzi i nepravilne rupe dobar su znak da treba provjeriti gredicu navečer ili rano ujutro.',
        symptoms:
            'Nepravilne rupe na lišću, oštećeni rubovi listova, izgriženi plodovi pri tlu, sluzavi srebrnkasti tragovi i slabije ili uništene mlade biljke.',
        favorableConditions:
            'Hladna, vlažna i sjenovita mjesta, biljni ostaci, daske, gust pokrov tla i kišni periodi pogoduju aktivnosti puževa.',
        severity:
            'Srednje do visoko na mladim biljkama i presadnicama; starije biljke bolje podnose manju defolijaciju.',
        affectedPlants: [
            'Bosiljak',
            'Grah',
            'Jagoda',
            'Kupus',
            'Mahuna',
            'Salata',
        ],
        operations: {
            prevention: ['applySlugProtectionPreparation'],
            reduction: ['applySlugProtectionPreparation'],
        },
        sources: ['umnSlugs'],
    },
    {
        kind: 'pest',
        name: 'Bijela mušica',
        shortDescription:
            'Sitni bijeli kukci koji sišu sokove s naličja listova, osobito u toplim i zaštićenim uvjetima.',
        description:
            'Bijele mušice imaju širok krug domaćina i mogu se brzo namnožiti u toplim uvjetima. Hrane se s naličja listova, izlučuju mednu rosu i slabe biljku. U gredici je važan pregled naličja listova i rana mehanička ili zaštitna reakcija.',
        symptoms:
            'Pri dodiru biljke uzlijeću sitni bijeli kukci. Na listovima se vide žućenje, ljepljiva medna rosa, čađava prevlaka i opće slabljenje biljke.',
        favorableConditions:
            'Toplo vrijeme, zaštićeni prostori, gust sklop i visoke populacije koje nisu rano uočene pogoduju jačem napadu.',
        severity:
            'Srednje: teško ih je kontrolirati kada populacija naraste, ali rana reakcija može smanjiti pritisak.',
        affectedPlants: [
            'Čili',
            'Krastavac',
            'Paprika',
            'Patlidžan',
            'Rajčica',
        ],
        operations: {
            prevention: ['applyPestProtectionPreparation'],
            reduction: ['rinsePestsFromPlant'],
            alleviation: ['applyPestProtectionPreparation'],
        },
        sources: ['ucIpmWhiteflies'],
    },
];
