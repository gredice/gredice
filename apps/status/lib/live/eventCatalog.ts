import type { LiveActivityCategory, LiveActivitySource } from './types';

type LiveEventDefinition = {
    source: LiveActivitySource;
    category: LiveActivityCategory;
    label: string;
    title: string;
    detail: string;
};

const garden = (
    label: string,
    title: string,
    detail: string,
): LiveEventDefinition => ({
    source: 'gredice',
    category: 'garden',
    label,
    title,
    detail,
});

const care = (
    label: string,
    title: string,
    detail: string,
): LiveEventDefinition => ({
    source: 'gredice',
    category: 'care',
    label,
    title,
    detail,
});

const journey = (
    label: string,
    title: string,
    detail: string,
): LiveEventDefinition => ({
    source: 'gredice',
    category: 'journey',
    label,
    title,
    detail,
});

const community = (
    label: string,
    title: string,
    detail: string,
): LiveEventDefinition => ({
    source: 'gredice',
    category: 'community',
    label,
    title,
    detail,
});

const exchange = (
    label: string,
    title: string,
    detail: string,
): LiveEventDefinition => ({
    source: 'gredice',
    category: 'exchange',
    label,
    title,
    detail,
});

const platform = (
    label: string,
    title: string,
    detail: string,
): LiveEventDefinition => ({
    source: 'vercel',
    category: 'platform',
    label,
    title,
    detail,
});

const code = (
    label: string,
    title: string,
    detail: string,
): LiveEventDefinition => ({
    source: 'github',
    category: 'code',
    label,
    title,
    detail,
});

export const liveEventCatalog: Record<string, LiveEventDefinition> = {
    'garden.create': garden(
        'Novi vrt',
        'Novi vrt dobio je svoje mjesto.',
        'Prazan prostor upravo je postao početak nečega živog.',
    ),
    'garden.blockPlace': garden(
        'Vrt',
        'Nešto novo stiglo je u vrt.',
        'Još jedan mali dio vrta pronašao je svoje mjesto.',
    ),
    'raisedBed.create': garden(
        'Gredica',
        'Nastala je nova gredica.',
        'Tlo je spremno za novu sezonu i nove biljke.',
    ),
    'raisedBed.place': garden(
        'Gredica',
        'Gredica je položena u vrt.',
        'Obris vrta upravo je dobio novi sloj.',
    ),
    'raisedBed.weedState.set': garden(
        'Tlo',
        'Tlo je ponovno uređeno.',
        'Sitna promjena ostavila je vidljiv trag u vrtu.',
    ),
    'raisedBedField.create': garden(
        'Polje',
        'Otvoren je novi komadić tla.',
        'Mjesto čeka biljku koja će ga ispuniti.',
    ),
    'raisedBedField.plantPlace': garden(
        'Sadnja',
        'Nova biljka pronašla je svoje mjesto.',
        'Tlo se smirilo, a korijen kreće svojim putem.',
    ),
    'raisedBedField.plantSchedule': garden(
        'Sadnja',
        'Dogovorena je nova sadnja.',
        'Jedna buduća biljka upravo je dobila svoj trenutak.',
    ),
    'raisedBedField.plantUpdate': garden(
        'Rast',
        'Biljka je ušla u novu fazu.',
        'Vrt pamti svaku malu promjenu na putu prema berbi.',
    ),
    'raisedBedField.plantBlock': garden(
        'Biljka',
        'Jedna biljka traži malo više pažnje.',
        'Vrt je zastao na trenutak kako bi mogao nastaviti zdravije.',
    ),
    'raisedBedField.plantReplaceSort': garden(
        'Sorta',
        'U vrt je stigla druga sorta.',
        'Plan sadnje prilagodio se stvarnom ritmu vrta.',
    ),
    'raisedBedField.weedState.set': garden(
        'Tlo',
        'Uređen je još jedan dio gredice.',
        'Trag rada ostao je između biljaka.',
    ),
    'raisedBedPlanting.lifecycle.started': garden(
        'Početak',
        'Počeo je novi životni ciklus.',
        'Od ovog trenutka vrt prati put biljke prema berbi.',
    ),
    'raisedBedPlanting.lifecycle.statusChanged': garden(
        'Rast',
        'Ciklus biljke krenuo je dalje.',
        'Nova faza zamijenila je prethodnu.',
    ),
    'raisedBedPlanting.task.scheduled': care(
        'Plan',
        'Dogovoren je sljedeći korak njege.',
        'Rad u vrtu dobio je svoje vrijeme.',
    ),
    'raisedBedPlanting.task.assigned': care(
        'Ruke',
        'Zadatak je pronašao svoje ruke.',
        'Netko će se uskoro pobrinuti za biljke.',
    ),
    'raisedBedPlanting.task.completed': care(
        'Njega',
        'Završen je još jedan korak njege.',
        'Biljke mogu mirno nastaviti rasti.',
    ),
    'raisedBedPlanting.task.verified': care(
        'Provjera',
        'Potvrđen je dobro obavljen posao.',
        'Vrt nastavlja dalje sa sigurnim tragom iza sebe.',
    ),
    'operation.acceptance': care(
        'Ruke',
        'Netko je preuzeo brigu o vrtu.',
        'Posao je dobio osobu koja će ga provesti.',
    ),
    'operation.assign': care(
        'Ruke',
        'Zadatak je pronašao svoje ruke.',
        'Sljedeća promjena u vrtu sada ima svog čuvara.',
    ),
    'operation.schedule': care(
        'Plan',
        'Rad u vrtu dobio je svoj termin.',
        'Vrijeme i biljke ponovno su usklađeni.',
    ),
    'operation.complete': care(
        'Njega',
        'Završen je još jedan tihi obilazak.',
        'Sve je na mjestu. Vrt može nastaviti rasti.',
    ),
    'operation.completionEvidence.update': care(
        'Trag',
        'Sačuvan je trag obavljenog posla.',
        'Još jedan trenutak iz vrta ostao je zabilježen.',
    ),
    'operation.verify': care(
        'Provjera',
        'Potvrđen je još jedan korak njege.',
        'Rad i stvarno stanje vrta ponovno su usklađeni.',
    ),
    'operation.block': care(
        'Pauza',
        'Jedan posao nakratko čeka.',
        'Vrt ponekad uspori prije nego što nastavi dalje.',
    ),
    'operation.fail': care(
        'Promjena',
        'Plan njege upravo se prilagodio.',
        'Sljedeći pokušaj krenut će boljim putem.',
    ),
    'operation.cancel': care(
        'Promjena',
        'Jedan plan više nije potreban.',
        'Vrt je napravio mjesta za drugačiji sljedeći korak.',
    ),
    'approvalRequest.create': care(
        'Pitanje',
        'Vrt čeka jednu malu odluku.',
        'Sljedeći korak zastao je taman dovoljno dugo za provjeru.',
    ),
    'approvalRequest.approve': care(
        'Odluka',
        'Sljedeći korak dobio je zeleno svjetlo.',
        'Rad u vrtu može mirno krenuti dalje.',
    ),
    'delivery.request.created': journey(
        'Put',
        'Počelo je novo putovanje iz vrta.',
        'Jedan paket dobio je svoj smjer.',
    ),
    'delivery.request.confirmed': journey(
        'Put',
        'Dogovoren je dolazak iz vrta.',
        'Vrijeme, mjesto i put sada su povezani.',
    ),
    'delivery.request.preparing': journey(
        'Priprema',
        'Nešto iz vrta priprema se za put.',
        'Berba se polako pretvara u pošiljku.',
    ),
    'delivery.request.ready': journey(
        'Spremno',
        'Paket iz vrta spreman je krenuti.',
        'Još samo put dijeli vrt od novog doma.',
    ),
    'delivery.request.route_started': journey(
        'Na putu',
        'Paket iz vrta upravo je krenuo.',
        'Mali komad sezone putuje prema svom domu.',
    ),
    'delivery.request.route_progress': journey(
        'Na putu',
        'Putovanje se nastavilo.',
        'Još jedna točka na putu ostala je iza paketa.',
    ),
    'delivery.request.arrived': journey(
        'Dolazak',
        'Paket je stigao blizu svog odredišta.',
        'Put se upravo pretvara u susret.',
    ),
    'delivery.request.fulfilled': journey(
        'Dolazak',
        'Putovanje iz vrta je završeno.',
        'Ono što je raslo sada je stiglo kući.',
    ),
    'account.create': community(
        'Zajednica',
        'Netko novi pridružio se vrtovima.',
        'Zajednica je upravo dobila još jedan početak.',
    ),
    'user.create': community(
        'Zajednica',
        'Otvorena su nova vrata prema vrtu.',
        'Još jedna osoba može početi svoj zeleni trag.',
    ),
    'account.referral.v1': community(
        'Poziv',
        'Netko je podijelio priču o vrtu.',
        'Jedan zeleni trag upravo vodi prema drugome.',
    ),
    'account.earnSunflowers': community(
        'Suncokreti',
        'U vrtu su zasjali novi suncokreti.',
        'Mala nagrada ostala je iza još jednog koraka.',
    ),
    'account.earnSunflowerDrop': community(
        'Suncokreti',
        'Pronađen je mali komad sunca.',
        'Vrt je nagradio jedan pažljiv pogled.',
    ),
    'account.spendSunflowers': community(
        'Suncokreti',
        'Suncokreti su pokrenuli nešto novo.',
        'Skupljeno svjetlo pretvorilo se u promjenu u vrtu.',
    ),
    'occasion.advent.calendar.open': community(
        'Trenutak',
        'Otvoren je još jedan sezonski trenutak.',
        'Vrt je pokazao malo iznenađenje.',
    ),
    'checkout.operation.created': exchange(
        'Odabir',
        'Odabran je novi korak za vrt.',
        'Jedna odluka upravo se pretvorila u budući rad.',
    ),
    'inventory.add': exchange(
        'Spremište',
        'Nešto novo stiglo je u spremište.',
        'Materijali za sljedeći korak sada su bliže vrtu.',
    ),
    'inventory.consume': exchange(
        'Spremište',
        'Materijal je pronašao svoju svrhu.',
        'Ono što je čekalo sada je postalo dio vrta.',
    ),
    'transaction.create': exchange(
        'Razmjena',
        'Dogodila se nova razmjena u vrtu.',
        'Jedna vrijednost pretvorila se u sljedeći korak.',
    ),
    'invoice.paid': exchange(
        'Potvrda',
        'Jedan dogovor je dovršen.',
        'Sve je spremno za ono što slijedi.',
    ),
    'receipt.fiscalize': exchange(
        'Potvrda',
        'Sačuvan je trag jedne razmjene.',
        'Sustav je tiho završio svoj dio posla.',
    ),
    'vercel.request': platform(
        'Zahtjev',
        'Novi zahtjev prošao je kroz sustav.',
        'Jedna aplikacija upravo je odgovorila nekome tko ju je otvorio.',
    ),
    'vercel.function': platform(
        'Izvršenje',
        'Poslužitelj je obavio još jedan tihi posao.',
        'Kod se pokrenuo, povezao dijelove sustava i nastavio dalje.',
    ),
    'vercel.build': platform(
        'Izgradnja',
        'Nova verzija upravo poprima oblik.',
        'Slojevi aplikacije ponovno se slažu u jednu cjelinu.',
    ),
    'vercel.guard': platform(
        'Zaštita',
        'Zaštitni sloj sustava upravo je reagirao.',
        'Promet je prošao kroz još jednu tihu provjeru.',
    ),
    'vercel.error': platform(
        'Signal',
        'Sustav je poslao jači signal.',
        'Jedan tehnički trag izdvojio se iz uobičajenog ritma.',
    ),
    'github.push': code(
        'Kod',
        'Nova promjena stigla je u repozitorij.',
        'Ideja se upravo pretvorila u dio zajedničkog koda.',
    ),
    'github.pull_request': code(
        'Promjena',
        'Otvoren je novi put kroz kod.',
        'Jedna promjena spremna je za razgovor i provjeru.',
    ),
    'github.merge': code(
        'Spojeno',
        'Promjena je postala dio cjeline.',
        'Novi kod upravo se pridružio glavnom toku.',
    ),
    'github.review': code(
        'Pregled',
        'Kod je dobio još jedan pažljiv pogled.',
        'Promjena se brusi prije nego što nastavi dalje.',
    ),
    'github.workflow.success': code(
        'Provjera',
        'Automatske provjere završile su mirno.',
        'Kod je prošao kroz svoj tehnički ritam.',
    ),
    'github.workflow.failure': code(
        'Provjera',
        'Automatska provjera poslala je signal.',
        'Jedan dio koda traži još malo pažnje.',
    ),
    'github.deployment.success': code(
        'Isporuka',
        'Nova verzija stigla je do aplikacija.',
        'Kod iz repozitorija upravo je postao dio stvarnog sustava.',
    ),
    'github.deployment.failure': code(
        'Isporuka',
        'Jedna isporuka poslala je jači signal.',
        'Nova verzija zastala je prije dolaska do aplikacija.',
    ),
    'github.release': code(
        'Izdanje',
        'Objavljena je nova cjelina.',
        'Niz promjena upravo je dobio zajednički trenutak.',
    ),
    'github.issue': code(
        'Razgovor',
        'Otvorena je nova tema za rad.',
        'Jedna ideja ili problem upravo je dobio svoje mjesto.',
    ),
};

export const domainLiveEventTypeEntries = Object.entries(liveEventCatalog)
    .filter(([, definition]) => definition.source === 'gredice')
    .map(([type, definition]) => ({
        type,
        category: definition.category,
    }));
