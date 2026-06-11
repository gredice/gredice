export type FirstRaisedBedTutorialTask = {
    id: string;
    title: string;
    shortDescription: string;
    guideDescription: string;
    steps: string[];
};

export const firstRaisedBedTutorialPath = '/vodic-za-prvu-gredicu';

export const firstRaisedBedTutorialTasks: FirstRaisedBedTutorialTask[] = [
    {
        id: 'choose-meals',
        title: 'Odaberi što želiš jesti',
        shortDescription:
            'Reci želiš li svježe salate, kuhanje, grickanje ili mirniju sezonu.',
        guideDescription:
            'Prvi odabir govori aplikaciji kakav vrt želiš otvoriti. Ne tražimo savršen plan, nego smjer: hoćeš li više svježih listova, povrće za umake i roštilj, brze zalogaje ili mirniji raspored s robusnijim kulturama.',
        steps: [
            'Pročitaj četiri ponuđena cilja i odaberi onaj koji najbolje opisuje obroke koje najčešće želiš.',
            'Ako nisi siguran, odaberi cilj koji zvuči najbliže tjednu koji stvarno kuhaš ili jedeš.',
            'Odabir možeš promijeniti prije nego otvoriš rasporede, pa slobodno isprobaj više kombinacija.',
        ],
    },
    {
        id: 'choose-care-rhythm',
        title: 'Odaberi ritam brige',
        shortDescription:
            'Odredi želiš li jednostavan, uravnotežen ili raznolik plan sadnje.',
        guideDescription:
            'Ritam brige pomaže složiti gredicu prema tome koliko različitih kultura želiš pratiti. Jednostavan plan ima mirniji izbor, uravnotežen plan miješa poznate kulture, a raznolik plan daje više boja i kombinacija.',
        steps: [
            'Odaberi "Jednostavno" ako želiš manje različitih biljaka i mirniji početak.',
            'Odaberi "Uravnoteženo" ako želiš dobru mješavinu za svježe obroke i kuhanje.',
            'Odaberi "Raznoliko" ako želiš isprobati više kultura u istoj gredici.',
        ],
    },
    {
        id: 'review-layouts',
        title: 'Pregledaj predložene rasporede',
        shortDescription:
            'Pogledaj gdje ide svaka biljka i zašto šest polja ostaje prazno.',
        guideDescription:
            'Svaki prijedlog popunjava 12 od 18 polja. Preostalih 6 polja ostaje prazno kako bi ih mogao popuniti kasnije, vlastitim odabirom ili sezonskom idejom.',
        steps: [
            'Otvori rasporede i pogledaj malu mrežu gredice.',
            'Usporedi nazive prijedloga, kratke opise i oznake biljaka u mreži.',
            'Odaberi raspored koji najbolje odgovara obrocima i ritmu koji si izabrao.',
        ],
    },
    {
        id: 'add-plan-to-cart',
        title: 'Dodaj plan u košaru',
        shortDescription:
            'Jednim klikom dodaj 12 sadnji u svoju gredicu za prvi termin.',
        guideDescription:
            'Kada dodaš plan u košaru, aplikacija pripremi stavke sjetve za odabrana polja u tvojoj prvoj gredici. To još nije konačna potvrda narudžbe, nego brzi način da se plan spremi za pregled.',
        steps: [
            'Provjeri da je označen raspored koji želiš.',
            'Klikni "Dodaj plan u košaru".',
            'Pričekaj da se stavke dodaju i da te aplikacija ostavi u closeup prikazu gredice.',
        ],
    },
    {
        id: 'confirm-cart',
        title: 'Dovrši narudžbu u košari',
        shortDescription:
            'Provjeri stavke i potvrdi narudžbu kako bi sadnja ušla u raspored.',
        guideDescription:
            'Plan iz onboardinga treba potvrditi kroz košaru. Tamo možeš još jednom pregledati biljke, polja i trošak prije nego narudžba postane stvarna radnja za tvoj vrt.',
        steps: [
            'Otvori košaru i pregledaj dodane stavke sjetve.',
            'Ako nešto ne želiš, ukloni tu stavku prije potvrde.',
            'Dovrši narudžbu kada si zadovoljan rasporedom.',
        ],
    },
    {
        id: 'customize-empty-fields',
        title: 'Uredi preostalih šest polja',
        shortDescription:
            'U closeup prikazu popuni prazna polja vlastitim idejama kad budeš spreman.',
        guideDescription:
            'Prazna polja su namjerno ostavljena za kasnije. Možeš ih popuniti omiljenom sortom, nečim što bolje odgovara sezoni ili biljkom koju želiš probati nakon prvog plana.',
        steps: [
            'U closeup prikazu klikni prazno polje u gredici.',
            'Odaberi biljku ili sortu koju želiš dodati.',
            'Dodaj je u košaru i potvrdi narudžbu kada želiš proširiti plan.',
        ],
    },
];
