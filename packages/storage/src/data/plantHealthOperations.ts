export const plantHealthMaintenanceStage = {
    id: 306,
    name: 'maintenance',
} as const;

type PlantHealthOperationApplication = 'plant' | 'raisedBedFull';
type PlantHealthOperationVisualReward =
    | 'agrotextile'
    | 'insectMesh'
    | 'removeAgrotextile'
    | 'removeInsectMesh';

export type PlantHealthOperationSpec = {
    name: string;
    label: string;
    shortDescription: string;
    description: string;
    instructions: string;
    application: PlantHealthOperationApplication;
    appliesToAllTargets: boolean;
    durationMinutes: number;
    frequency: 'optional';
    deliverable: boolean;
    internal: boolean;
    printLabel: boolean;
    completionAttachImages: boolean;
    completionAttachImagesRequired: boolean;
    completionAttachNotes: boolean;
    completionAttachNotesRequired: boolean;
    stageId: typeof plantHealthMaintenanceStage.id;
    pricePerOperation: number;
    coverUrl: string;
    visualReward?: PlantHealthOperationVisualReward | null;
};

export const plantHealthOperationSpecs = [
    {
        name: 'sanitizeSeedlingGrowingArea',
        label: 'Sanacija prostora za uzgoj presadnica',
        shortDescription:
            'Preventivno čišćenje i uređenje prostora oko presadnice radi smanjenja zadržavanja vlage i rizika od polijeganja.',
        description:
            'Sanacija prostora za uzgoj presadnica preventivna je radnja kojom se uklanjaju odumrli biljni ostaci, provjeravaju čistoća, drenaža i prozračnost te smanjuju uvjeti koji pogoduju polijeganju presadnica. Posebna se pozornost posvećuje stajaćoj vodi, previše mokrom supstratu, pregustom rasporedu i ostacima uz osnovu stabljike.\n\nRadnja ne zamjenjuje dijagnostiku. Presadnica koja pokazuje stanjivanje ili tamnjenje stabljike uz površinu supstrata, venuće ili poleganje odvaja se od zdravih presadnica, a sumnjivi materijal odmah se stavlja u zatvorenu posudu kako se ne bi raznosio po prostoru za uzgoj.',
        instructions:
            '1. Pregledati presadnicu, osnovu stabljike, površinu supstrata, posudu i podlogu ispod nje.\n2. Presadnicu sa znakovima stanjivanja, tamnjenja, venuća ili poleganja odvojiti od zdravih presadnica i zabilježiti nalaz.\n3. Ukloniti odumrle listove, ostatke i sumnjivi rasuti materijal izravno u zatvorenu posudu; ne raznositi ga kroz prostor za uzgoj.\n4. Očistiti radnu površinu i vanjski dio posude čistim alatom te ne vraćati sumnjivi rasuti supstrat među zdrave presadnice.\n5. Provjeriti otjecanje vode i ukloniti stajaću vodu. Supstrat treba ostati umjereno vlažan, a ne natopljen.\n6. Osigurati dovoljan razmak i blago strujanje zraka bez oštećivanja mladih biljaka.\n7. Nakon rada očistiti alat i ruke te nastaviti pratiti susjedne presadnice.',
        application: 'plant',
        appliesToAllTargets: true,
        durationMinutes: 2,
        frequency: 'optional',
        deliverable: false,
        internal: true,
        printLabel: false,
        completionAttachImages: true,
        completionAttachImagesRequired: false,
        completionAttachNotes: true,
        completionAttachNotesRequired: false,
        stageId: plantHealthMaintenanceStage.id,
        pricePerOperation: 0.2,
        coverUrl:
            'https://www.gredice.com/assets/operation-icons/plantPhoto.webp',
    },
    {
        name: 'inspectAndManuallyRemovePests',
        label: 'Pregled i ručno uklanjanje štetnika',
        shortDescription:
            'Pregled biljke i pažljivo ručno uklanjanje prepoznatih vidljivih štetnika i jajašaca uz očuvanje korisnih organizama.',
        description:
            'Radnja obuhvaća sustavan pregled biljke i mehaničko uklanjanje jasno prepoznatih vidljivih štetnika kada je to praktično i sigurno za biljku. Može uključivati gusjenice, štetne kornjaše, njihove ličinke, nakupine jajašaca te puževe golaće i puževe s kućicom koji se hrane biljkom.\n\nPrije uklanjanja potrebno je razlikovati štetnike od korisnih organizama. Oprašivači, grabežljivi kukci, parazitoidi i drugi korisni organizmi ostavljaju se na biljci. Jedinke koje nije moguće pouzdano prepoznati fotografiraju se i evidentiraju umjesto da se uklone. Ova radnja smanjuje trenutačnu brojnost vidljivih štetnika, ali ne potvrđuje da je problem potpuno uklonjen, pa je potreban ponovni pregled.',
        instructions:
            '1. Pregledati naličje i lice listova, mlade izboje, stabljiku, pazušce listova te površinu tla uz biljku. Puževe je najlakše uočiti rano ujutro ili navečer.\n2. Prepoznati ciljane štetnike prije uklanjanja. Ne uklanjati oprašivače, grabežljive kukce, parazitoide ni druge korisne organizme.\n3. Pažljivo rukom u rukavici ili čistim alatom prikupiti vidljive gusjenice, štetne kornjaše, ličinke, nakupine jajašaca te puževe golaće i puževe s kućicom kada je to praktično.\n4. Prikupljeni materijal staviti u zatvorenu posudu; ne gnječiti ga po biljci i ne ostavljati uz gredicu.\n5. Ako identifikacija nije sigurna, snimiti jasnu fotografiju i ostaviti jedinku dok se nalaz ne provjeri.\n6. Zabilježiti vrstu nalaza, približan broj i oštećenja te dogovoriti ponovni pregled biljke.',
        application: 'plant',
        appliesToAllTargets: true,
        durationMinutes: 3,
        frequency: 'optional',
        deliverable: false,
        internal: false,
        printLabel: false,
        completionAttachImages: true,
        completionAttachImagesRequired: false,
        completionAttachNotes: true,
        completionAttachNotesRequired: false,
        stageId: plantHealthMaintenanceStage.id,
        pricePerOperation: 0.4,
        coverUrl:
            'https://www.gredice.com/assets/operation-icons/hygiene-pruning.webp',
    },
    {
        name: 'installInsectProtectionMesh',
        label: 'Postavljanje zaštitne mreže protiv kukaca',
        shortDescription:
            'Postavljanje odgovarajuće mreže preko cijele gredice kao fizičke prepreke letećim štetnicima.',
        description:
            'Zaštitna mreža protiv kukaca fizička je prepreka koja otežava pristup ciljanim letećim štetnicima cijeloj podignutoj gredici. Veličina oka odabire se prema štetniku, a mreža se postavlja prije očekivanog leta ili napada, preko lukova ili druge potpore, bez pritiskanja biljaka.\n\nUčinkovitost prepreke ovisi o tome da su svi rubovi zatvoreni i da ispod mreže prije postavljanja nema ciljnih štetnika. Mrežu treba redovito pregledavati zbog rupa, podignutih rubova, pregrijavanja i zadržavanja vlage. Kod kultura kojima za oplodnju trebaju oprašivači mora se unaprijed odrediti način i vrijeme sigurnog otvaranja.',
        instructions:
            '1. Odrediti ciljanog štetnika i odabrati mrežu odgovarajuće veličine oka koja ipak omogućuje dovoljno zraka i svjetlosti.\n2. Prije postavljanja pregledati biljke i tlo te ukloniti jasno prepoznate ciljane štetnike kako ih mreža ne bi zatvorila u gredici.\n3. Postaviti lukove ili drugu potporu tako da mreža ne pritišće lišće i da biljke imaju prostor za rast.\n4. Prekriti cijelu gredicu i učvrstiti sve rubove bez otvora kroz koje kukci mogu ući.\n5. Provjeriti prozračivanje, temperaturu i vlagu ispod mreže. Za kulture kojima trebaju oprašivači otvoriti mrežu samo u planirano vrijeme i ponovno je pravilno zatvoriti.\n6. Nakon vjetra, rada u gredici i rasta biljaka pregledati ima li rupa ili podignutih rubova te ih odmah popraviti.',
        application: 'raisedBedFull',
        appliesToAllTargets: false,
        durationMinutes: 5,
        frequency: 'optional',
        deliverable: false,
        internal: false,
        printLabel: false,
        completionAttachImages: true,
        completionAttachImagesRequired: false,
        completionAttachNotes: false,
        completionAttachNotesRequired: false,
        stageId: plantHealthMaintenanceStage.id,
        pricePerOperation: 2.99,
        coverUrl:
            'https://www.gredice.com/assets/operation-icons/setAgrotextileWhite.webp',
        visualReward: 'insectMesh',
    },
    {
        name: 'removeInsectProtectionMesh',
        label: 'Uklanjanje zaštitne mreže protiv kukaca',
        shortDescription:
            'Pažljivo završno skidanje zaštitne mreže s cijele gredice nakon završetka razdoblja zaštite.',
        description:
            'Uklanjanje zaštitne mreže protiv kukaca provodi se kada je završilo razdoblje leta ciljanog štetnika i mreža više ne treba ostati na podignutoj gredici. Mreža se završno skida s cijele gredice bez povlačenja preko listova, cvjetova i mladih plodova. Kratkotrajno podizanje mreže radi pregleda, njege, berbe ili oprašivanja nije obuhvaćeno ovom radnjom.\n\nPrije uklanjanja treba provjeriti ima li na vanjskoj strani mreže štetnika te je li rizik od njihova ulaska doista završen. Nakon skidanja mreža se čisti, potpuno suši i sprema za ponovnu uporabu, a oštećenja se evidentiraju radi popravka ili zamjene.',
        instructions:
            '1. Potvrditi da je završilo razdoblje zaštite od ciljanog štetnika i da mreža nakon ove radnje više neće ostati na gredici.\n2. Pregledati vanjsku stranu mreže, biljke i rubove gredice te zabilježiti vidljive štetnike, rupe ili podignuta učvršćenja.\n3. Pažljivo otpustiti sva učvršćenja i rubove, počevši od jedne strane gredice, bez naglog tresenja mreže iznad biljaka.\n4. Podignuti mrežu preko potpore bez povlačenja po listovima, cvjetovima i mladim plodovima te je u cijelosti ukloniti iz radnog prostora.\n5. Nakon skidanja pregledati biljke i unutrašnjost gredice te spremiti potpore i učvršćenja koja se više ne koriste.\n6. Ukloniti zemlju i biljne ostatke, očistiti mrežu prema uputi proizvođača te je potpuno osušiti prije spremanja.\n7. Suhu i neoštećenu mrežu uredno složiti ili namotati i označiti; oštećenu mrežu izdvojiti za popravak ili zamjenu.',
        application: 'raisedBedFull',
        appliesToAllTargets: false,
        durationMinutes: 1,
        frequency: 'optional',
        deliverable: false,
        internal: false,
        printLabel: false,
        completionAttachImages: true,
        completionAttachImagesRequired: false,
        completionAttachNotes: false,
        completionAttachNotesRequired: false,
        stageId: plantHealthMaintenanceStage.id,
        pricePerOperation: 0.2,
        coverUrl:
            'https://www.gredice.com/assets/operation-icons/removeAgrotextileWhite.webp',
        visualReward: 'removeInsectMesh',
    },
] as const satisfies readonly PlantHealthOperationSpec[];

export type PlantHealthOperationCopyUpdate = {
    entityId: number;
    name: string;
    description: string;
    instructions: string;
};

export const plantHealthOperationCopyUpdates = [
    {
        entityId: 319,
        name: 'hygiene-pruning',
        description:
            'Sanitarna rezidba uklanja jasno zahvaćene, odumrle ili teško oštećene dijelove biljke kako bi se smanjilo širenje problema i omogućio bolji pregled preostalog zdravog tkiva. Reže se samo kada se zahvaćeni dio može sigurno odvojiti bez nepotrebnog oštećivanja biljke, po mogućnosti dok je biljka suha.\n\nUklonjeni materijal odmah se odvaja od zdravih biljnih ostataka i stavlja u zatvorenu vreću ili posudu. Ne ostavlja se uz gredicu i ne kompostira se niti spaljuje automatski. Način zbrinjavanja određuje se prema potvrđenom problemu i važećem protokolu OPG-a. Alat se čisti i dezinficira prije rada te između zahvaćenih biljaka kako se problem ne bi prenosio rezidbom.',
        instructions:
            '1. Pregledati suhu biljku i označiti samo jasno zahvaćene, odumrle ili teško oštećene dijelove.\n2. Očistiti i dezinficirati alat prije početka rada te prije prelaska na drugu biljku.\n3. Odrezati zahvaćeni dio čistim rezom, uz odgovarajući rub zdravog tkiva samo kada je to prikladno za biljku i uočeni problem.\n4. Svaki uklonjeni dio odmah staviti u zatvorenu vreću ili posudu; ne odlagati ga na tlo ili uz gredicu.\n5. Materijal odvojiti od zdravih ostataka i zbrinuti prema potvrđenom problemu i protokolu OPG-a. Ne kompostirati ga niti spaljivati automatski.\n6. Nakon rada ponovno očistiti alat i ruke, pregledati susjedne biljke te zabilježiti nalaz i opseg rezidbe.',
    },
    {
        entityId: 346,
        name: 'plantRemoval',
        description:
            'Uklanjanje biljke provodi se na kraju zdravog vegetacijskog ciklusa, kada biljka više nije potrebna ili kada je zbog sumnje na bolest ili štetnika treba izdvojiti iz gredice. Biljka se uklanja zajedno s korijenom i preostalim plodovima, uz što manje rasipanja zemlje i biljnih ostataka po drugim poljima.\n\nZdravi ostaci biljke uklonjene na kraju ciklusa mogu se odložiti na kompostište OPG-a u skladu s uobičajenim pravilima kompostiranja. Materijal sa znakovima bolesti ili ozbiljnog napada štetnika odmah se stavlja u zatvorenu vreću ili posudu, odvaja od zdravog materijala i zbrinjava prema potvrđenom problemu i protokolu OPG-a. Takav se materijal ne kompostira niti spaljuje automatski. Oprema koja se može ponovno koristiti čisti se prije premještanja na drugu gredicu.',
        instructions:
            '1. Utvrditi uklanja li se zdrava biljka na kraju ciklusa ili biljka sa sumnjom na bolest ili ozbiljan napad štetnika. Za sumnjivu biljku unaprijed pripremiti zatvorenu vreću ili posudu.\n2. Pažljivo iščupati ili iskopati biljku s korijenom, uz što manje rasipanja zemlje i ostataka po gredici.\n3. Ukloniti preostale plodove i biljne ostatke. Odvojiti potpornje i drugu opremu za čišćenje prije ponovne uporabe.\n4. Zdravi materijal s kraja vegetacijskog ciklusa može se odnijeti na kompostište OPG-a. Sumnjivi ili zahvaćeni materijal odmah zatvoriti, izdvojiti iz prostora uzgoja i zbrinuti prema potvrđenom problemu i protokolu OPG-a; ne kompostirati ga niti spaljivati automatski.\n5. Očistiti alat, obuću i radnu površinu prije rada na drugoj gredici. Tlo poravnati i pripremiti tek nakon potrebnih biosigurnosnih mjera.',
    },
] as const satisfies readonly PlantHealthOperationCopyUpdate[];

export type PlantHealthOperationApplicabilityUpdate = {
    entityId: number;
    name: string;
};

export const plantHealthOperationApplicabilityUpdates = [
    {
        entityId: 319,
        name: 'hygiene-pruning',
    },
    {
        entityId: 583,
        name: 'rinsePestsFromPlant',
    },
] as const satisfies readonly PlantHealthOperationApplicabilityUpdate[];
