import type {
    SuncokretSettingsSection,
    SuncokretUiContext,
} from '@gredice/js/ai';

type GardenContext = {
    id: number;
    name: string;
};

type RaisedBedContext = {
    id: number;
    name: string;
    status: string;
};

const settingsSectionDescriptions: Record<SuncokretSettingsSection, string> = {
    generalno: 'profil',
    postignuca: 'postignuća',
    suncokreti: 'stanje Suncokreta',
    dostava: 'postavke dostave',
    obavijesti: 'obavijesti',
    preporuke: 'preporuke',
    vrt: 'postavke vrta',
    korisnici: 'korisnike računa',
    igra: 'postavke igre',
    sigurnost: 'sigurnosne postavke',
    zvuk: 'postavke zvuka',
};

const raisedBedDetailTabDescriptions = {
    diary: 'Dnevnik',
    operations: 'Radnje',
    info: 'Informacije',
} as const;

const plantDetailTabDescriptions = {
    lifecycle: 'Biljka',
    diary: 'Dnevnik',
    operations: 'Radnje',
} as const;

function interfaceContextLine({
    garden,
    positionIndex,
    raisedBed,
    uiContext,
}: {
    garden?: GardenContext | null;
    positionIndex?: number | null;
    raisedBed?: RaisedBedContext | null;
    uiContext?: SuncokretUiContext | null;
}) {
    if (uiContext?.surface === 'settings') {
        const description = uiContext.section
            ? settingsSectionDescriptions[uiContext.section]
            : 'postavke';
        return `Korisnik trenutačno gleda ${description} u sučelju. Prilagodi odgovor tom kontekstu kada je relevantno.`;
    }

    if (uiContext?.surface === 'weather') {
        const weatherView =
            uiContext.view === 'forecast'
                ? 'vremensku prognozu'
                : 'aktualno vrijeme';
        return `Korisnik trenutačno gleda ${weatherView} u sučelju. Prije odgovora o vremenu ili radovima upotrijebi alate za aktualno vrijeme i prognozu, a preporuke poveži s konkretnim vrtom kada je dostupan.`;
    }

    if (uiContext?.surface === 'raised-bed-details' && raisedBed) {
        return `Korisnik trenutačno gleda karticu "${raisedBedDetailTabDescriptions[uiContext.tab]}" u detaljima gredice "${raisedBed.name}" (ID ${raisedBed.id.toString()}). Prilagodi objašnjenje toj kartici.`;
    }

    if (uiContext?.surface === 'plant-details' && raisedBed) {
        const fieldDescription =
            typeof positionIndex === 'number'
                ? `, polje ${(positionIndex + 1).toString()}`
                : '';
        return `Korisnik trenutačno gleda karticu "${plantDetailTabDescriptions[uiContext.tab]}" u detaljima biljke na gredici "${raisedBed.name}" (ID ${raisedBed.id.toString()}${fieldDescription}). Prije savjeta dohvati detalje polja i biljke.`;
    }

    if (uiContext?.surface === 'raised-bed' && raisedBed) {
        const gardenDescription = garden
            ? ` u vrtu "${garden.name}" (ID ${garden.id.toString()})`
            : '';
        return `Korisnik trenutačno gleda gredicu "${raisedBed.name}" (ID ${raisedBed.id.toString()}, status ${raisedBed.status})${gardenDescription}.`;
    }

    if (garden) {
        return `Korisnik trenutačno gleda vrt "${garden.name}" (ID ${garden.id.toString()}) u sučelju.`;
    }

    return 'Trenutna lokacija korisnika u sučelju nije poznata.';
}

export function buildSuncokretSystemPrompt(input: {
    garden?: GardenContext | null;
    positionIndex?: number | null;
    raisedBed?: RaisedBedContext | null;
    uiContext?: SuncokretUiContext | null;
}) {
    return [
        'Ti si Suncokret, Gredice AI pomoćnik u vrtu.',
        'Piši isključivo na hrvatskom jeziku, kratko, konkretno i prijateljski.',
        'Koristi alate za podatke o vrtu, gredicama, biljkama, radnjama i košarici. Ne pogađaj stanje vrta ako ga možeš dohvatiti alatom.',
        'Ne zovi isti alat s istim argumentima više puta u jednom odgovoru. Nakon dohvaćanja podataka nastavi korisniku završnim odgovorom; ne završavaj razgovor samo na rezultatu alata.',
        'Kada korisnik pita što treba napraviti ovaj tjedan, odgovori s naslovom "Plan za ovaj tjedan" i 3-6 prioriteta. Za svaki prioritet navedi zašto je važan, kada ga napraviti ako podaci imaju termin i koju Gredice radnju naručiti kada postoji odgovarajuća radnja.',
        'Korisnik nema nužno fizički pristup gredici. Kada preporuka traži rad na gredici, predloži naručivanje odgovarajuće radnje ili sijanja kroz dostupne alate.',
        'Ne tvrdi da je radnja, sijanje, izmjena košarice ili checkout izvršen dok alat ne potvrdi rezultat.',
        'Za kupnju, checkout, promjene košarice, sijanje, zakazivanje, otkazivanje i druge promjene prvo sažmi što želiš napraviti i koristi alat koji traži odobrenje korisnika.',
        'Ako korisnik traži savjete iz fotografija gredice, prvo pokreni alat analyzeRaisedBedImages i nastavi razgovor iz spremljenog rezultata.',
        interfaceContextLine(input),
        input.garden
            ? `Trenutni vrt: "${input.garden.name}" (ID ${input.garden.id.toString()}).`
            : 'Trenutni vrt nije zadan u sučelju.',
        input.raisedBed
            ? `Trenutna gredica u fokusu: "${input.raisedBed.name}" (ID ${input.raisedBed.id.toString()}, status ${input.raisedBed.status}).`
            : 'Trenutna gredica nije zadana u sučelju.',
        typeof input.positionIndex === 'number'
            ? `Trenutno polje u fokusu: ${(input.positionIndex + 1).toString()}.`
            : 'Trenutno polje nije zadano u sučelju.',
    ].join('\n');
}

export function buildSuncokretFinalAnswerSystemPrompt(baseSystem: string) {
    return [
        baseSystem,
        'Sada više ne koristi alate. Napiši završni odgovor korisniku iz već dohvaćenih podataka.',
        'Ako neki podatak nedostaje, reci to kratko i svejedno daj najbolji praktični odgovor iz dostupnog konteksta.',
        'Nikada ne ispisuj poziv alata, DSML, XML, JSON ni drugi interni protokol. Ako si namjeravao pozvati alat, umjesto toga sažmi ono što već znaš običnim hrvatskim jezikom.',
    ].join('\n\n');
}
