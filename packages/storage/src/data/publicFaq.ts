/** Reviewed public FAQ seed. Runtime answers are read from the directory, not this file. */
export const publicFaqCategories = [
    {
        name: 'service',
        label: 'Kako Gredice funkcioniraju',
    },
    {
        name: 'pricing',
        label: 'Cijene, plaćanje i suncokreti',
    },
    {
        name: 'usage',
        label: 'Sadnja i planiranje gredice',
    },
    {
        name: 'maintenance',
        label: 'Održavanje i radnje',
    },
    {
        name: 'harvest-and-plant-removal',
        label: 'Berba i urod',
    },
    {
        name: 'delivery',
        label: 'Dostava i osobno preuzimanje',
    },
    {
        name: 'kvaliteta-i-sigurnost-uroda',
        label: 'Kvaliteta i sigurnost uroda',
    },
    {
        name: 'account',
        label: 'Račun, privatnost i podrška',
    },
];

export const publicFaqEntries = [
    {
        name: 'how-to-use-the-service',
        category: 'service',
        header: 'Kako se usluga koristi?',
        content:
            'U aplikaciji odaberi biljke, rasporedi ih u gredicu i potvrdi narudžbu. Partnerski OPG obavlja naručene radnje na stvarnoj gredici. U aplikaciji pratiš rast, planiraš njegu te naručuješ berbu i dostavu uroda. Kreni uz [vodič za prvu gredicu](/vodic-za-prvu-gredicu).',
    },
    {
        name: 'real-garden',
        category: 'service',
        header: 'Je li vrt u aplikaciji povezan sa stvarnom gredicom?',
        content:
            'Da. Digitalna gredica predstavlja stvarnu podignutu gredicu na partnerskom OPG-u. Kod gredice, fotografije i zapisi radnji pomažu ti pratiti što se događa na terenu. [Upoznaj gredicu](/podignuta-gredica).',
    },
    {
        name: 'garden-location',
        category: 'service',
        header: 'Gdje se nalazi moja gredica?',
        content:
            'Gredice se nalaze na partnerskom OPG-u u Bosiljevu u Bjelovarsko-bilogorskoj županiji. Ondje se obavljaju sadnja, njega i berba. Lokacija uzgoja razlikuje se od lokacije za osobno preuzimanje uroda u Zagrebu. [Više o gredici](/podignuta-gredica).',
    },
    {
        name: 'own-raised-bed',
        category: 'service',
        header: 'Dobivam li vlastitu gredicu ili je dijelim s drugim korisnicima?',
        content:
            'Tvoja gredica ima vlastiti kod i nije zajednička gredica nepovezanih korisnika. Standardna gredica ima 18 polja za planiranje sadnje na površini od 2 × 1 m. [Pogledaj gredicu](/podignuta-gredica).',
    },
    {
        name: 'vegetable-box',
        category: 'service',
        header: 'Kupujem li gotovu košaricu povrća?',
        content:
            'U Gredicama prvo biraš biljke za svoju gredicu, pratiš njihov rast i naručuješ berbu kada je urod spreman. Vrijeme do prve dostave zato ovisi o odabranim biljkama i njihovu razvoju. [Kako funkcionira dostava uroda](/dostava-povrca-zagreb).',
    },
    {
        name: 'who-owns-tools-space',
        category: 'service',
        header: 'Trebam li vlastiti prostor, alat ili sjeme?',
        content:
            'Ne trebaš osigurati vlastiti vrt, alat ili sjeme. Uzgoj i naručene radnje odvijaju se na partnerskom OPG-u, a ti odabireš biljke i pratiš gredicu kroz aplikaciju. [Što uključuje sjetva](/sjetva).',
    },
    {
        name: 'is-experience-required',
        category: 'service',
        header: 'Što ako nemam iskustva u vrtlarstvu?',
        content:
            'Možeš krenuti uz prijedlog sadnje i kratke upute u aplikaciji. Na stranicama biljaka provjeri potrebe odabranih kultura, a za pomoć nam se javi izravno. [Otvori vodič za prvu gredicu](/vodic-za-prvu-gredicu).',
    },
    {
        name: 'pricing-what-does-it-cost',
        category: 'pricing',
        header: 'Koliko košta korištenje Gredica?',
        content:
            'Trošak ovisi o odabranim biljkama, naručenim radnjama i dostavi. Prije potvrde pregledaj stavke i ukupni iznos u košari. Aktualne cijene biljaka, radnji i paketa suncokreta pronađi u [cjeniku](/cjenik).',
    },
    {
        name: 'payment-per-order',
        category: 'pricing',
        header: 'Plaćam li paket suncokreta jednokratno?',
        content:
            'Da. Kupnjom paketa nadoplaćuješ Gredice saldo za naručivanje vrtnih radnji. Paket je nadoplata bodova, a ne pretplata na automatsko održavanje ili obećanje da pokriva sve troškove sezone. [Pogledaj pakete suncokreta](/suncokreti).',
    },
    {
        name: 'sowing-price-unit',
        category: 'pricing',
        header: 'Plaćam li sadnju po biljci, polju ili gredici?',
        content:
            'Javni cjenik prikazuje cijenu po posađenoj biljci, uz zasebnu cijenu sorte kada je definirana. Broj biljaka u polju ovisi o kulturi i razmaku sadnje. Radnje mogu obuhvaćati biljku ili cijelu gredicu, pa prije potvrde provjeri naziv, količinu i ukupnu cijenu stavke u košari. [Otvori cjenik](/cjenik).',
    },
    {
        name: 'sunflower-balance',
        category: 'pricing',
        header: 'Što su suncokreti i za što ih mogu koristiti?',
        content:
            'Suncokreti su Gredice bodovi za sadnju, njegu, berbu, dostavu i druge vrtne radnje. Saldo vidiš u aplikaciji nakon uspješne uplate. Bodovi se koriste unutar Gredica i ne prenose se na druge račune. [Više o suncokretima](/suncokreti).',
    },
    {
        name: 'sunflower-reservation',
        category: 'pricing',
        header: 'Kada se suncokreti naplaćuju, a kada vraćaju?',
        content:
            'Potreban iznos oduzima se sa salda odmah pri potvrdi narudžbe radnje, a ne tek nakon izvršenja. Ako se radnja otkaže prije obrade, suncokreti se vraćaju na saldo kao povrat. Za već izvršenu radnju povrat ili korekciju dogovaraš s podrškom. [Pravila salda i povrata](/povrati-i-povrat-novca).',
    },
    {
        name: 'sunflower-bonus',
        category: 'pricing',
        header: 'Kako funkcioniraju bonus suncokreti?',
        content:
            'Ako paket uključuje bonus, dodatni broj suncokreta prikazan je uz paket i dodaje se na saldo. Bonus ne predstavlja zaseban novčani iznos niti automatsko pravo na isplatu u novcu. Uvjete i ograničenja provjeri uz [odabrani paket](/suncokreti).',
    },
    {
        name: 'request-refund',
        category: 'pricing',
        header: 'Kako mogu zatražiti povrat novca?',
        content:
            'Javi se podršci, navedi narudžbu ili radnju i opiši problem. Za biljke i radnje javna politika predviđa zahtjev unutar 30 dana od kupnje. Nakon provjere dogovaramo povrat novca ili korekciju salda; povrat se ne provodi automatski. [Pročitaj pravila povrata](/povrati-i-povrat-novca).',
    },
    {
        name: 'choice-of-plants',
        category: 'usage',
        header: 'Mogu li odabrati što će rasti u mojoj gredici?',
        content:
            'Da. U aplikaciji biraš biljke i njihov raspored prema dostupnosti, sezoni i prostoru. Prije odabira provjeri potrebe biljke, razmak sadnje i dostupne sorte. [Pregledaj biljke](/biljke).',
    },
    {
        name: 'fill-bed-gradually',
        category: 'usage',
        header: 'Moram li odmah popuniti cijelu gredicu?',
        content:
            'Ne. Dio polja možeš ostaviti prazan i dodati nove biljke kasnije. Početni prijedlog raspoređuje sadnju u 12 od 18 polja, a preostalih šest ostavlja za tvoj odabir. [Vodič za prvu gredicu](/vodic-za-prvu-gredicu).',
    },
    {
        name: 'plant-availability',
        category: 'usage',
        header: 'Zašto biljka trenutačno nije dostupna za sadnju?',
        content:
            'Kalendar sjetve pokazuje okvirno razdoblje za uzgoj, a dostupnost naručivanja provjerava se zasebno. Dostupne biljke i sorte vidiš pri odabiru u aplikaciji. Ako željena biljka nije u ponudi, provjeri druge sorte ili nam se javi za pomoć. [Pregledaj biljke](/biljke).',
    },
    {
        name: 'cart-confirmation',
        category: 'usage',
        header: 'Je li dodavanje biljke u košaru već potvrđena narudžba?',
        content:
            'Ne. Košara služi za pregled plana i troška. Sadnju treba potvrditi dovršavanjem narudžbe u košari. Prije potvrde možeš ukloniti stavke i provjeriti raspored. [Kako potvrditi prvi plan sadnje](/vodic-za-prvu-gredicu).',
    },
    {
        name: 'sowing-included',
        category: 'usage',
        header: 'Što uključuje cijena sjetve?',
        content:
            'Cijena sjetve uključuje nabavu sjemena, pripremu tla i evidenciju radnje u aplikaciji. Točna cijena ovisi o biljci, a sezonske pogodnosti provjeri prije narudžbe. [Pročitaj detalje o sjetvi](/sjetva).',
    },
    {
        name: 'maintenance-self-or-team',
        category: 'maintenance',
        header: 'Što radim ja, a što obavlja tim na OPG-u?',
        content:
            'Ti u aplikaciji biraš biljke, planiraš i naručuješ radnje te pratiš stanje vrta. Tim na partnerskom OPG-u obavlja fizički rad: pripremu tla, sadnju, naručenu njegu i berbu. Za pomoć pri planiranju [javi nam se](/kontakt).',
    },
    {
        name: 'automatic-garden-care',
        category: 'maintenance',
        header: 'Obavlja li se održavanje automatski?',
        content:
            'Radnje njege planiraš i naručuješ u aplikaciji. Pojedine pogodnosti uz sjetvu mogu uključivati zalijevanja prema uvjetima ponude. Pregledaj raspored i uključene radnje; obavijest ili podsjetnik sam po sebi nije potvrda nove narudžbe. [Provjeri pogodnosti sjetve](/sjetva).',
    },
    {
        name: 'operation-completed',
        category: 'maintenance',
        header: 'Kako znam da je naručena radnja izvršena?',
        content:
            'U aplikaciji provjeri status radnje i zapise za svoju gredicu. Zakazana radnja još nije izvršena radnja. Ako status ili zapis nije jasan, podršci pošalji naziv radnje i kod gredice. [Zatraži pomoć](/kontakt).',
    },
    {
        name: 'cancel-operation',
        category: 'maintenance',
        header: 'Mogu li otkazati naručenu radnju?',
        content:
            'Mogućnost otkazivanja ovisi o trenutačnom statusu radnje. Ako je otkazivanje dostupno u aplikaciji, koristi tu mogućnost i provjeri potvrdu. Za radnju koja je već u obradi ili izvršena javi se podršci. Kod otkazivanja prije obrade plaćeni suncokreti vraćaju se na saldo. [Pravila povrata](/povrati-i-povrat-novca).',
    },
    {
        name: 'operation-scope',
        category: 'maintenance',
        header: 'Odnosi li se radnja na biljku ili na cijelu gredicu?',
        content:
            'Opseg je naveden uz radnju: neke se odnose na odabranu biljku, a druge na cijelu gredicu. Prije potvrde provjeri naziv radnje, odabrane biljke ili gredicu te ukupni iznos. [Pregledaj radnje](/radnje).',
    },
    {
        name: 'how-ofter-is-maintenance-required',
        category: 'maintenance',
        header: 'Koliko često gredica treba održavanje?',
        content:
            'Potrebe ovise o biljci, razvojnoj fazi, vremenu i stanju tla. Prati svoju gredicu i upute za odabranu kulturu umjesto jednog rasporeda za sve biljke. [Provjeri potrebe biljaka](/biljke).',
    },
    {
        name: 'long-absence-garden-care',
        category: 'maintenance',
        header: 'Što mogu napraviti prije dužeg putovanja?',
        content:
            'Prije odsutnosti pregledaj stanje vrta i unaprijed planiraj potrebne radnje. Aplikaciji možeš pristupiti i na putu. Ako nećeš moći pratiti vrt, javi nam se unaprijed kako bismo dogovorili pomoć. [Kontaktiraj nas](/kontakt).',
    },
    {
        name: 'garden-storm-protection',
        category: 'maintenance',
        header: 'Kako vremenske nepogode utječu na moj vrt?',
        content:
            'Uzgoj na otvorenom ovisi o vremenskim uvjetima, pa oluja, vjetar ili tuča mogu oštetiti biljke. Ne obećavamo potpunu zaštitu od nepogoda. Za informacije o stanju tvoje gredice i mogućim sljedećim koracima [javi nam se](/kontakt).',
    },
    {
        name: 'resposibility-plant-dry-out',
        category: 'maintenance',
        header: 'Što ako biljke propadnu zbog vremena ili problema s njegom?',
        content:
            'Javi nam se s kodom gredice i opisom problema kako bismo provjerili stanje i evidenciju radnji. Ti planiraš i naručuješ njegu, a OPG izvršava fizičke radnje. Rješenje ovisi o uzroku i provjeri konkretnog slučaja. [Provjeri pravila povrata i korekcija](/povrati-i-povrat-novca).',
    },
    {
        name: 'plant-dry-out-no-watering-any-help',
        category: 'maintenance',
        header: 'Kako mogu pratiti kada gredica treba njegu?',
        content:
            'Prati stanje biljaka, raspored radnji i obavijesti u aplikaciji. Provjeri i postavke obavijesti na svojem uređaju. Ako trebaš pomoć s planiranjem zalijevanja ili druge njege, [javi nam se](/kontakt).',
    },
    {
        name: 'plants-dry-out-replant',
        category: 'maintenance',
        header: 'Što ako se biljke osuše ili uvenu?',
        content:
            'Najprije provjeri stanje gredice i javi nam se kako bismo procijenili što se može oporaviti, a što treba ponovno posaditi. Za dogovor o ponovnoj sadnji ili korekciji narudžbe [kontaktiraj podršku](/kontakt).',
    },
    {
        name: 'first-harvest',
        category: 'harvest-and-plant-removal',
        header: 'Kada mogu očekivati prvu berbu?',
        content:
            'Vrijeme do berbe ovisi o kulturi, sorti, datumu sadnje, vremenu i njezi. Kalendar rasta na stranici biljke daje okvirnu procjenu; stvarnu spremnost prati kroz stanje gredice. [Pregledaj biljke i kalendare rasta](/biljke).',
    },
    {
        name: 'estimated-yield',
        category: 'harvest-and-plant-removal',
        header: 'Je li prikazani prinos zajamčena količina?',
        content:
            'Prikazani prinos je procjena. Stvarna količina ovisi o sorti, uvjetima uzgoja, njezi i stanju biljke. Procjenu koristi za planiranje, a raspoloživ urod provjeri prije berbe. [Više o uzgoju u gredici](/podignuta-gredica).',
    },
    {
        name: 'repeat-harvest',
        category: 'harvest-and-plant-removal',
        header: 'Mogu li naručiti više berbi iste biljke?',
        content:
            'Ovisi o kulturi i dostupnoj radnji. Kod nekih biljaka bere se cijela biljka, a kod drugih se plodovi ili listovi mogu brati postupno dok biljka daje urod. Provjeri dostupne vrste berbe za svoju biljku u aplikaciji. [Pregledaj radnje berbe](/radnje).',
    },
    {
        name: 'remove-after-harvest',
        category: 'harvest-and-plant-removal',
        header: 'Zašto se neke biljke uklone nakon berbe, a neke ne?',
        content:
            'Kod berbe cijele biljke, poput mrkve, uklanja se i sama biljka. Kod postupne berbe plodova ili listova biljka može ostati u polju dok daje urod, a uklanjanje se naručuje zasebno. Opseg provjeri uz odabranu radnju berbe. [Pregledaj radnje](/radnje).',
    },
    {
        name: 'delivery-coverage',
        category: 'delivery',
        header: 'Kako provjeriti dostavljate li na moju adresu?',
        content:
            'Na stranici dostave upiši adresu i provjeri dostupnost i procjenu cijene. Dostava je dostupna unutar Hrvatske do 100 km vožnje od lokacije za preuzimanje. Konačnu cijenu provjeri pri naručivanju. [Provjeri svoju adresu](/dostava).',
    },
    {
        name: 'delivery-price',
        category: 'delivery',
        header: 'Koliko košta dostava?',
        content:
            'Dostava na adrese unutar Grada Zagreba je besplatna. Izvan Zagreba cijena ovisi o udaljenosti vožnje od lokacije za preuzimanje prema aktualnoj tarifi. Prije narudžbe provjeri adresu i izračun na stranici [Dostava](/dostava).',
    },
    {
        name: 'delivery-booking',
        category: 'delivery',
        header: 'Koliko unaprijed trebam rezervirati dostavu?',
        content:
            'Dostavu planiraj najmanje 48 sati unaprijed i odaberi raspoloživ dvosatni termin. Dostupnost ovisi o rasporedu, a nakon zahtjeva provjeri potvrdu dostave. [Pogledaj termine](/dostava/termini).',
    },
    {
        name: 'delivery-pickup',
        category: 'delivery',
        header: 'Gdje mogu osobno preuzeti urod?',
        content:
            'Urod možeš besplatno preuzeti na dostupnoj lokaciji Gredice HQ u Zagrebu. Pri naručivanju odaberi osobno preuzimanje te lokaciju i termin. Točnu adresu provjeri na stranici [Dostava](/dostava).',
    },
    {
        name: 'delivery-missed',
        category: 'delivery',
        header: 'Što ako nisam kod kuće u dogovorenom terminu?',
        content:
            'Pokušat ćemo te kontaktirati. Ako dostava ne uspije, urod možeš naknadno osobno preuzeti na lokaciji u Zagrebu. Prema pravilima dostave, urod koji se ne preuzme u roku od 72 sata donira se. [Provjeri pravila dostave](/dostava).',
    },
    {
        name: 'delivery-confirmation',
        category: 'delivery',
        header: 'Znači li prikaz slobodnog termina da je dostava potvrđena?',
        content:
            'Ne. Prikaz termina pomaže ti planirati, a dostavu treba naručiti u aplikaciji. Nakon zahtjeva provjeri obavijest o potvrdi ili odbijanju jer raspoloživost ovisi o popunjenosti rasporeda. [Otvori termine dostave](/dostava/termini).',
    },
    {
        name: 'kvaliteta-haccp-certifikacija',
        category: 'kvaliteta-i-sigurnost-uroda',
        header: 'Postoji li formalna HACCP certifikacija?',
        content:
            'Ne. Javno opisujemo interne postupke koji se oslanjaju na dobru praksu, sljedivost, evidencije, korektivne radnje i načela HACCP-a. To nije tvrdnja o formalnoj certifikaciji. [Pročitaj kako pratimo kvalitetu i sigurnost uroda](/kvaliteta-i-sigurnost-uroda).',
    },
    {
        name: 'kvaliteta-pracenje-sigurnosti',
        category: 'kvaliteta-i-sigurnost-uroda',
        header: 'Kako se prati sigurnost uroda?',
        content:
            'Pratimo rizike, čistoću, rukovanje, berbu, dostavu i prigovore kako bi se sumnja na problem mogla procijeniti i zapisati. Evidencije povezuju gredicu, berbu i dostavu. [Više o kvaliteti i sigurnosti](/kvaliteta-i-sigurnost-uroda).',
    },
    {
        name: 'kvaliteta-dokumentirani-postupci',
        category: 'kvaliteta-i-sigurnost-uroda',
        header: 'Koji su postupci dokumentirani?',
        content:
            'Dokumentirani su postupci za higijenu, edukaciju, procjenu gredice, vodu, inpute, čišćenje opreme, berbu, sortiranje, dostavu, sljedivost i prigovore. [Pročitaj pregled postupaka](/kvaliteta-i-sigurnost-uroda).',
    },
    {
        name: 'kvaliteta-pranje-uroda',
        category: 'kvaliteta-i-sigurnost-uroda',
        header: 'Trebam li oprati urod prije jela?',
        content:
            'Da. Svježe ubrano povrće i bilje prije konzumacije operi i pripremi na uobičajen higijenski način. [Više o pripremi i sigurnosti uroda](/kvaliteta-i-sigurnost-uroda).',
    },
    {
        name: 'kvaliteta-sumnja-na-problem',
        category: 'kvaliteta-i-sigurnost-uroda',
        header: 'Što ako postoji sumnja na problem s urodom?',
        content:
            'Ako primijetiš problem, javi nam se s podacima o berbi ili dostavi i opisom onoga što vidiš. Kod sumnje na kontaminaciju ili izgubljenu sljedivost urod se zadržava ili izdvaja do procjene, a problem i korektivna radnja evidentiraju se. [Kontaktiraj podršku](/kontakt).',
    },
    {
        name: 'account-members',
        category: 'account',
        header: 'Može li više osoba upravljati istim vrtom?',
        content:
            'Da. U aplikaciji možeš poslati pozivnicu za pridruživanje svojem računu. Nakon prihvaćanja pozivnice druga osoba pristupa zajedničkim vrtovima računa. Pozivnica daje pristup računu, pa je šalji samo osobi s kojom želiš dijeliti upravljanje. [Otvori aplikaciju](https://vrt.gredice.com).',
    },
    {
        name: 'garden-visibility',
        category: 'account',
        header: 'Tko može vidjeti moj vrt?',
        content:
            'Javni vrt dostupan je posjetiteljima javnih stranica. Vidljivost vrta možeš promijeniti u postavkama vrta u aplikaciji. Javni prikaz ne daje posjetiteljima mogućnost naručivanja radnji na tvojem računu. [Pogledaj javne vrtove](/vrtovi).',
    },
    {
        name: 'order-support',
        category: 'account',
        header: 'Kako mogu dobiti pomoć za konkretnu narudžbu?',
        content:
            'Javi nam se izravno i navedi narudžbu ili radnju, kod gredice i kratak opis problema. Podatke o plaćanju i druge osobne podatke šalji podršci, a ne u javnu zajednicu. [Otvori kontakt](/kontakt).',
    },
    {
        name: 'companion-planting-choice',
        category: 'usage',
        header: 'Moram li uvijek saditi dobre susjede zajedno?',
        content:
            'Ne. Dobar susjed je prijedlog koji može pomoći pri rasporedu. Ako biljci više odgovara drugo mjesto zbog sunca, razmaka ili termina sadnje, taj kontekst ima prednost. [Više o biljnim susjedima](/biljni-susjedi).',
    },
    {
        name: 'companion-planting-distance',
        category: 'usage',
        header: 'Znači li loš susjed da biljke nikako ne smiju biti blizu?',
        content:
            'Ne nužno. To je signal za oprez. U maloj gredici često je dovoljno ostaviti razmak, ne saditi ih u isto polje ili ih razdvojiti drugom kulturom. [Više o biljnim susjedima](/biljni-susjedi).',
    },
    {
        name: 'companion-planting-missing',
        category: 'usage',
        header: 'Zašto neke biljke nemaju prikazane susjede?',
        content:
            'Za neke biljke nemamo dovoljno pouzdano mapirane podatke ili se izvori previše razilaze. Tada je bolje prikazati manje informacija nego sigurnije zvučati nego što podaci dopuštaju. [Više o biljnim susjedima](/biljni-susjedi).',
    },
    {
        name: 'companion-planting-use',
        category: 'usage',
        header: 'Kako Gredice koriste ove podatke?',
        content:
            'Prikazujemo dobre i loše susjede na javnim stranicama biljaka te ih koristimo kao signal u vrtu kada biraš što posaditi pokraj postojećih biljaka. [Više o biljnim susjedima](/biljni-susjedi).',
    },
];
