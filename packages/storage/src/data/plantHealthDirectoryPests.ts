import type {
    PlantHealthDirectoryIssue,
    PlantHealthDirectoryPlantName,
} from './plantHealthDirectory';

const allPlants = [
    'Artičoka',
    'Bamija',
    'Blitva',
    'Bob',
    'Bosiljak',
    'Brokula',
    'Celer',
    'Cikla',
    'Cvjetača',
    'Dinja',
    'Grah',
    'Grašak',
    'Jagoda',
    'Kadulja',
    'Kamilica',
    'Kelj',
    'Kelj pupčar',
    'Komorač',
    'Kopar',
    'Koraba',
    'Korijandar',
    'Krastavac',
    'Kupus',
    'Ljupčac',
    'Luk',
    'Luk vlasac',
    'Mahuna',
    'Matičnjak',
    'Matovilac',
    'Mrkva',
    'Origano',
    'Paprika',
    'Patlidžan',
    'Peršin',
    'Poriluk',
    'Rajčica',
    'Raštika',
    'Repa',
    'Rotkvica',
    'Rukola',
    'Salata',
    'Tikva',
    'Tikvice',
    'Timijan',
    'Češnjak',
    'Čili',
    'Špinat',
] as const satisfies readonly PlantHealthDirectoryPlantName[];

const brassicaPlants = [
    'Brokula',
    'Cvjetača',
    'Kelj',
    'Kelj pupčar',
    'Koraba',
    'Kupus',
    'Raštika',
    'Repa',
    'Rotkvica',
    'Rukola',
] as const satisfies readonly PlantHealthDirectoryPlantName[];

const alliumPlants = [
    'Luk',
    'Luk vlasac',
    'Poriluk',
    'Češnjak',
] as const satisfies readonly PlantHealthDirectoryPlantName[];

export const plantHealthDirectoryPests = [
    {
        kind: 'pest',
        name: 'Lisne uši',
        shortDescription:
            'Skupina sitnih mekanih kukaca koji sišu biljne sokove, najčešće na mladim izbojima i naličju listova.',
        description:
            'Brojne vrste lisnih uši koriste različite domaćine, pa ovaj zapis predstavlja skupinu, a ne jednu univerzalnu vrstu. Osim izravnog sisanja sokova, uši izlučuju ljepljivu mednu rosu i neke vrste prenose biljne viruse. Rani pregled mladog rasta olakšava reakciju dok je kolonija još lokalizirana.',
        symptoms:
            'Uvijanje mladih listova, žućenje, zastoj rasta, ljepljiva medna rosa, crna čađava prevlaka na mednoj rosi i vidljive kolonije sitnih zelenih, crnih, sivih ili žućkastih kukaca.',
        favorableConditions:
            'Bujan i mekan mladi rast, blago do toplo vrijeme i obližnje zaražene biljke pogoduju naseljavanju. Mravi mogu štititi kolonije jer se hrane mednom rosom.',
        severity:
            'Nisko do srednje kod ranog uočavanja; visoko na mladim biljkama, pri velikim kolonijama ili kada se prenese virusna bolest.',
        affectedPlants: allPlants,
        operations: {
            reduction: ['rinsePestsFromPlant'],
        },
        reconcileOperations: true,
        sources: ['ucIpmAphids', 'umnAphids'],
        reviewNotes: [
            'Zapis predstavlja više vrsta lisnih uši sa specifičnim krugovima domaćina; prisutnost pojedine vrste mora se potvrditi pregledom.',
        ],
    },
    {
        kind: 'pest',
        name: 'Puževi',
        shortDescription:
            'Puževi i golaći hrane se noću ili za vlažna vremena te ostavljaju nepravilne rupe i sluzave tragove.',
        description:
            'Puževi vole hladna, vlažna i zasjenjena mjesta. Najviše štete rade na klijancima, mladim presadnicama, nježnom lišću i plodovima uz tlo. Trag sluzi i nepravilne rupe dobar su znak da gredicu treba pregledati navečer ili rano ujutro.',
        symptoms:
            'Nepravilne rupe na lišću, izgrizeni rubovi, oštećeni plodovi pri tlu, srebrnkasti tragovi sluzi i naglo nestale ili presječene mlade biljke.',
        favorableConditions:
            'Hladna, vlažna i sjenovita mjesta, biljni ostaci, daske, gust pokrov tla, korov i kišni periodi pogoduju aktivnosti i skrivanju.',
        severity:
            'Srednje do visoko na klijancima, presadnicama i lisnatim kulturama; razvijene biljke bolje podnose manji gubitak lišća.',
        affectedPlants: [
            'Artičoka',
            'Blitva',
            'Bosiljak',
            'Brokula',
            'Celer',
            'Cikla',
            'Cvjetača',
            'Grah',
            'Jagoda',
            'Kadulja',
            'Kamilica',
            'Kelj',
            'Kelj pupčar',
            'Komorač',
            'Kopar',
            'Koraba',
            'Korijandar',
            'Krastavac',
            'Kupus',
            'Ljupčac',
            'Luk vlasac',
            'Mahuna',
            'Matičnjak',
            'Matovilac',
            'Origano',
            'Patlidžan',
            'Peršin',
            'Poriluk',
            'Raštika',
            'Repa',
            'Rotkvica',
            'Rukola',
            'Salata',
            'Tikva',
            'Tikvice',
            'Timijan',
            'Špinat',
        ],
        operations: {
            prevention: ['applySlugProtectionPreparation'],
            reduction: [
                'inspectAndManuallyRemovePests',
                'applySlugProtectionPreparation',
            ],
        },
        sources: ['umnSlugs', 'rhsHerbsContainers'],
    },
    {
        kind: 'pest',
        name: 'Bijela mušica',
        shortDescription:
            'Sitni bijeli kukci koji sišu sokove s naličja listova, osobito u toplim i zaštićenim uvjetima.',
        description:
            'Stakleničke i srodne bijele mušice imaju širok krug domaćina i mogu se brzo namnožiti u toplim uvjetima. Hrane se s naličja listova, izlučuju mednu rosu i slabe biljku. U gredici je važan pregled naličja i rana reakcija prije nego što se razviju brojne preklapajuće generacije.',
        symptoms:
            'Pri dodiru biljke uzlijeću sitni bijeli kukci. Na naličju su priljubljene blijede ličinke, a na listovima se vide žućenje, ljepljiva medna rosa, čađava prevlaka i opće slabljenje.',
        favorableConditions:
            'Toplo vrijeme, zaštićeni prostori, gust sklop i nedostatak prirodnih neprijatelja pogoduju brzom rastu populacije.',
        severity:
            'Srednje: teško ih je smanjiti kada se populacija razvije u više stadija, ali rana reakcija često ograničava štetu.',
        affectedPlants: [
            'Čili',
            'Krastavac',
            'Paprika',
            'Patlidžan',
            'Rajčica',
        ],
        operations: {
            reduction: ['rinsePestsFromPlant'],
        },
        reconcileOperations: true,
        sources: ['ucIpmWhiteflies'],
    },
    {
        kind: 'pest',
        name: 'Kupusna bijela mušica',
        shortDescription:
            'Bijela mušica specijalizirana za lisnate kupusnjače koja na naličju lista stvara kolonije i ljepljivu mednu rosu.',
        description:
            'Kupusna bijela mušica razlikuje se od stakleničke bijele mušice i uglavnom ostaje na kupusnjačama. Biljke često podnose samo sisanje, ali kolonije, medna rosa i čađava prevlaka posebno smetaju na kelju, raštici i dijelovima koji se izravno beru za jelo.',
        symptoms:
            'Oblak sitnih bijelih kukaca uzlijeće s naličja kada se list pomakne. Na naličju ostaju plosnate blijedozelene ličinke, a gornja strana može biti ljepljiva i prekrivena crnom čađavom prevlakom.',
        favorableConditions:
            'Kontinuirani uzgoj lisnatih kupusnjača, blago vrijeme i ostavljanje starog vanjskog lišća omogućuju održavanje više generacija tijekom sezone.',
        severity:
            'Nisko do srednje za rast biljke; srednje do visoko za kakvoću jestivog lista pri velikim kolonijama i čađavoj prevlaci.',
        affectedPlants: [
            'Brokula',
            'Cvjetača',
            'Kelj',
            'Kelj pupčar',
            'Kupus',
            'Raštika',
        ],
        operations: {
            reduction: ['rinsePestsFromPlant'],
        },
        reconcileOperations: true,
        sources: ['rhsCabbageWhitefly'],
    },
    {
        kind: 'pest',
        name: 'Koprivina grinja',
        shortDescription:
            'Vrlo sitna grinja koja siše stanice lista, stvara svijetle točkice, brončanje i finu paučinu pri jačem napadu.',
        description:
            'Koprivina grinja i bliske vrste često se uoče tek nakon što se na lišću pojavi sitno točkanje. Populacija se može vrlo brzo povećati za vrućeg i suhog vremena, osobito na biljkama pod stresom.',
        symptoms:
            'Mnoštvo sitnih blijedih točkica na listu prelazi u žućenje ili brončanu boju. Naličje može imati pokretne točkice i jaja, a pri jakom napadu finu paučinu, suhe rubove i prerano otpadanje.',
        favorableConditions:
            'Vruće, suho i prašnjavo vrijeme, nedostatak vode i zaštićeni prostori pogoduju brzom razmnožavanju.',
        severity:
            'Srednje do visoko: manji napad usporava rast, a velika populacija može osušiti većinu lišća i snažno smanjiti urod.',
        affectedPlants: [
            'Cikla',
            'Dinja',
            'Grah',
            'Grašak',
            'Jagoda',
            'Krastavac',
            'Luk',
            'Luk vlasac',
            'Mahuna',
            'Mrkva',
            'Paprika',
            'Patlidžan',
            'Poriluk',
            'Rajčica',
            'Repa',
            'Rotkvica',
            'Salata',
            'Tikva',
            'Tikvice',
            'Češnjak',
            'Čili',
        ],
        operations: {
            reduction: ['rinsePestsFromPlant'],
        },
        reconcileOperations: true,
        sources: ['umnSpiderMites', 'usuSpiderMitesVegetables'],
    },
    {
        kind: 'pest',
        name: 'Sovice pozemljuše',
        shortDescription:
            'Noćno aktivne gusjenice koje pregrizaju mlade biljke pri površini tla ili izgrizaju lišće i stabljike.',
        description:
            'Sovice se danju skrivaju u površinskom sloju tla, a hrane se noću. Najprepoznatljivija šteta je zdrava presadnica pronađena odrezana pri tlu; neke vrste se penju na biljku ili ostaju pod zemljom i oštećuju korijen.',
        symptoms:
            'Mlade biljke su presječene ili jako izgrizene neposredno iznad tla. Uz biljku se u zemlji često nalazi glatka siva, smeđa ili zelenkasta gusjenica koja se pri dodiru savije u slovo C.',
        favorableConditions:
            'Zakorovljene površine, mnogo biljnih ostataka i sadnja mladih presadnica na mjesto na kojem su ženke ranije položile jaja povećavaju rizik.',
        severity:
            'Visoko na klijancima i presadnicama jer jedna gusjenica može u kratkom vremenu uništiti više biljaka; niže na razvijenim biljkama.',
        affectedPlants: [
            'Artičoka',
            'Brokula',
            'Celer',
            'Cvjetača',
            'Grah',
            'Grašak',
            'Kelj',
            'Kelj pupčar',
            'Koraba',
            'Kupus',
            'Mahuna',
            'Mrkva',
            'Paprika',
            'Rajčica',
            'Raštika',
            'Repa',
            'Rotkvica',
            'Rukola',
            'Salata',
            'Čili',
        ],
        operations: {
            reduction: ['inspectAndManuallyRemovePests'],
        },
        sources: ['umnCutworms'],
    },
    {
        kind: 'pest',
        name: 'Lisni mineri povrća',
        shortDescription:
            'Ličinke sitnih muha koje se hrane unutar lista i ostavljaju vijugave hodnike ili svijetle nepravilne mine.',
        description:
            'Više vrsta minera napada različito povrće. Budući da ličinka živi između gornje i donje pokožice, zaštićena je od mnogih vanjskih utjecaja; rano uklanjanje malog broja zaraženih listova najkorisnije je na lisnatim kulturama.',
        symptoms:
            'Bijeli ili prozirni vijugavi hodnici i veće mjehuraste mine u listu, često s tamnom crtom izmeta. Jako minirani listovi smeđe, suše se i gube uporabnu površinu.',
        favorableConditions:
            'Topla razdoblja, obližnje zaražene biljke ili korovi i uzastopni osjetljivi usjevi omogućuju više generacija.',
        severity:
            'Nisko do srednje na razvijenim plodonosnim biljkama; visoko kada se izravno bere list ili su mlade biljke gusto napadnute.',
        affectedPlants: [
            'Brokula',
            'Celer',
            'Cvjetača',
            'Grah',
            'Grašak',
            'Kelj',
            'Kelj pupčar',
            'Koraba',
            'Krastavac',
            'Kupus',
            'Mahuna',
            'Paprika',
            'Patlidžan',
            'Rajčica',
            'Raštika',
            'Repa',
            'Rotkvica',
            'Rukola',
            'Salata',
            'Tikva',
            'Tikvice',
            'Čili',
        ],
        operations: {
            prevention: ['installInsectProtectionMesh'],
            reduction: ['hygiene-pruning'],
        },
        sources: ['umnLeafminers'],
        reviewNotes: [
            'Repina muha i miner poriluka imaju zasebne zapise jer su njihovi domaćini, biologija i šteta prepoznatljiviji.',
        ],
    },
    {
        kind: 'pest',
        name: 'Repina muha',
        shortDescription:
            'Lisni miner cikle, blitve i špinata čije ličinke stvaraju velike blijede mine u jestivom lišću.',
        description:
            'Ličinke repine muhe hrane se između slojeva lista, a više početnih hodnika može se spojiti u široku mrlju. Budući da se na blitvi i špinatu bere upravo list, i umjeren napad može učiniti velik dio uroda neuporabljivim.',
        symptoms:
            'Na listu nastaju blijeda, gotovo prozirna polja koja kasnije posmeđe i smežuraju se. Unutar mine mogu se vidjeti bjelkaste ličinke ili tamne nakupine izmeta.',
        favorableConditions:
            'Odrasle muhe aktivne su od proljeća do jeseni i mogu razviti više generacija. Uzastopni uzgoj osjetljivih biljaka na istom mjestu omogućuje izlazak novih odraslih iz tla.',
        severity:
            'Srednje do visoko na blitvi i špinatu zbog izravnog gubitka lista; razvijena cikla lakše podnosi manji napad.',
        affectedPlants: ['Blitva', 'Cikla', 'Špinat'],
        operations: {
            prevention: ['installInsectProtectionMesh'],
            reduction: ['hygiene-pruning'],
        },
        sources: ['rhsBeetLeafMiner'],
    },
    {
        kind: 'pest',
        name: 'Buhači',
        shortDescription:
            'Sitni skakavi kornjaši koji izgrizaju mnoštvo okruglih rupica i mogu ozbiljno oslabiti mlade biljke.',
        description:
            'Više vrsta buhača napada kupusnjače, pomoćnice i druge povrtne biljke. Odrasli pri uznemiravanju skaču poput buhe, pa ih je teže uočiti od karakteristične sačmaste štete koju ostavljaju.',
        symptoms:
            'Mnoštvo sitnih okruglih rupica ili plitkih udubljenja daje listu izgled pogođen sačmom. Klijanci mogu zastati, izgubiti većinu lisne površine ili potpuno propasti.',
        favorableConditions:
            'Toplo i suho vrijeme, korovi domaćini, stari biljni ostaci i sporo rastući klijanci povećavaju štetu.',
        severity:
            'Srednje do visoko na klijancima i tek presađenim biljkama; razvijene biljke često podnose umjerenu izgrizenost.',
        affectedPlants: [
            'Brokula',
            'Cvjetača',
            'Dinja',
            'Grah',
            'Kelj',
            'Kelj pupčar',
            'Koraba',
            'Kupus',
            'Mahuna',
            'Paprika',
            'Patlidžan',
            'Rajčica',
            'Raštika',
            'Repa',
            'Rotkvica',
            'Rukola',
            'Salata',
            'Tikva',
            'Tikvice',
            'Čili',
            'Špinat',
        ],
        operations: {
            prevention: ['installInsectProtectionMesh'],
        },
        sources: ['umnFleaBeetles'],
    },
    {
        kind: 'pest',
        name: 'Gusjenice kupusnjača',
        shortDescription:
            'Gusjenice kupusnih bijelaca i više vrsta moljaca koje izgrizaju listove i zavlače se u glavice kupusnjača.',
        description:
            'Na kupusnjačama se istodobno može hraniti više vrsta leptira i moljaca. Neke gusjenice ostaju na vanjskim listovima, dok se druge uvlače u srce biljke, glavicu ili cvat, gdje onečišćenje izmetom povećava stvarnu štetu.',
        symptoms:
            'Nepravilne rupe, rubovi pojedeni do žila, prozoraste površine lista, vidljive zelene ili žuto-crne gusjenice i tamne grudice izmeta u srcu biljke.',
        favorableConditions:
            'Od proljeća do jeseni odrasli leptiri i moljci polažu jaja na nezaštićene kupusnjače; kontinuirana sadnja osigurava hranu za više generacija.',
        severity:
            'Srednje do visoko: nekoliko gusjenica lako se uklanja, ali brojne ličinke mogu ogoliti biljku ili učiniti glavicu neuporabljivom.',
        affectedPlants: brassicaPlants,
        operations: {
            prevention: ['installInsectProtectionMesh'],
            reduction: ['inspectAndManuallyRemovePests'],
        },
        sources: ['rhsCabbageCaterpillars'],
    },
    {
        kind: 'pest',
        name: 'Kupusna muha',
        shortDescription:
            'Ličinke muhe koje se hrane korijenom kupusnjača, uzrokuju venuće mladih biljaka i hodnike u jestivom korijenu.',
        description:
            'Odrasla kupusna muha polaže jaja uz bazu biljke, a ličinke se uvlače u korijen. Presadnice mogu naglo propasti, dok na repi i rotkvici i manji broj hodnika izravno smanjuje kakvoću jestivog dijela.',
        symptoms:
            'Biljka slabo raste, poprima plavkastu ili žutu boju i vene usred dana. Na korijenu se vide bijele ličinke i smeđi hodnici; rotkvica i repa mogu biti izbušene i podložne truleži.',
        favorableConditions:
            'Svježe posađene kupusnjače, hladnije proljeće i uzastopni uzgoj iste porodice na istom mjestu povećavaju rizik prve, često najštetnije generacije.',
        severity:
            'Visoko na presadnicama, rotkvici i repi; razvijene lisnate kupusnjače lakše podnose dio oštećenja korijena.',
        affectedPlants: brassicaPlants,
        operations: {
            prevention: ['installInsectProtectionMesh'],
            alleviation: ['plantRemoval'],
        },
        sources: ['rhsCabbageRootFly'],
    },
    {
        kind: 'pest',
        name: 'Lukova muha',
        shortDescription:
            'Ličinke muhe koje ulaze u bazu i lukovicu luka ili češnjaka te uzrokuju venuće i sekundarnu trulež.',
        description:
            'Lukova muha polaže jaja blizu osjetljivih biljaka, a ličinke se hrane korijenom, podankom i lukovicom. Više ličinki može prijeći sa zahvaćene na susjednu biljku, osobito u gustom redu.',
        symptoms:
            'Mlada biljka žuti, vene i lako se izvlači iz tla. Baza ili lukovica je meka, izbušena i neugodna mirisa, a unutra se mogu pronaći bjelkaste ličinke bez nogu.',
        favorableConditions:
            'Hladnije proljetno vrijeme, ostaci zaraženih lukovica i čest uzgoj luka ili češnjaka na istom mjestu pogoduju održavanju populacije.',
        severity:
            'Visoko na mladim biljkama i lukovicama: izravna šteta često prelazi u bakterijsku trulež i potpun gubitak biljke.',
        affectedPlants: ['Luk', 'Poriluk', 'Češnjak'],
        operations: {
            prevention: ['installInsectProtectionMesh'],
            alleviation: ['plantRemoval'],
        },
        sources: ['umnRootMaggots', 'rhsOnionFly'],
    },
    {
        kind: 'pest',
        name: 'Duhanov trips',
        legacyNames: ['Lukov trips'],
        label: 'Duhanov trips (Thrips tabaci)',
        shortDescription:
            'Vrlo sitni izduženi kukci koji se skrivaju u pregibima lista i ostavljaju srebrnkaste pruge i točkice.',
        description:
            'Lukov trips najvažniji je na jestivim lukovima, iako se može hraniti i na drugim kulturama. Ličinke i odrasli stružu površinu lista i sišu sadržaj stanica, pa se veća populacija često prvo vidi kao srebrno-sivi izgled usjeva.',
        symptoms:
            'Srebrnkaste pruge i blijedo točkanje, sitne crne kapljice izmeta, uvijanje i sušenje vrhova. U pregibima lista mogu se naći vrlo sitni žućkasti ili smeđi kukci.',
        favorableConditions:
            'Vruće i suho vrijeme, gust sklop i biljke pod vodnim stresom pogoduju brzom rastu populacije; jaka kiša može privremeno smanjiti brojnost.',
        severity:
            'Srednje do visoko: jak napad smanjuje lisnu površinu i razvoj lukovice, a na vlascu i poriluku izravno narušava jestivi list.',
        affectedPlants: alliumPlants,
        operations: {
            prevention: ['installInsectProtectionMesh'],
            reduction: ['rinsePestsFromPlant'],
        },
        sources: ['usuOnionThrips'],
    },
    {
        kind: 'pest',
        name: 'Miner poriluka',
        shortDescription:
            'Ličinke muhe koje miniraju listove, stabljike i lukovice poriluka, luka, vlasca i češnjaka.',
        description:
            'Odrasle ženke prvo ostavljaju nizove uboda na listu, a ličinke zatim putuju prema bazi biljke. Oštećeno tkivo često naseljavaju gljivice i bakterije, pa se pravi opseg problema vidi tek kada biljka počne trunuti.',
        symptoms:
            'Nizovi bijelih točkica, svijetli hodnici, uvijeni i deformirani listovi te bijele ličinke ili smeđe kukuljice unutar stabljike i lukovice. Kasnije se razvija mekana sekundarna trulež.',
        favorableConditions:
            'Odrasle muhe aktivne su u proljeće i ponovno u jesen. Blage sezone i uzastopni uzgoj jestivih lukova omogućuju razvoj dviju generacija.',
        severity:
            'Srednje do visoko: izravni hodnici slabe biljku, a sekundarna trulež može učiniti poriluk ili lukovicu potpuno neuporabljivima.',
        affectedPlants: alliumPlants,
        operations: {
            prevention: ['installInsectProtectionMesh'],
            reduction: ['hygiene-pruning'],
        },
        sources: ['rhsAlliumLeafMiner'],
    },
    {
        kind: 'pest',
        name: 'Mrkvina muha',
        shortDescription:
            'Ličinke sitne muhe koje stvaraju hrđastosmeđe hodnike u korijenu mrkve i srodnog povrća.',
        description:
            'Mrkvina muha napada prvenstveno mrkvu, ali i peršin, celer te druge bliske štitarke. Odrasli su slabi letači koji pronalaze domaćina po mirisu, dok ličinke skriveno oštećuju korijen i otvaraju put truleži.',
        symptoms:
            'Na površini i u unutrašnjosti korijena vide se zahrđali smeđi hodnici i tanke kremaste ličinke. Lišće može pocrvenjeti, požutjeti ili venuti, a korijen postaje gorak i sklon sekundarnoj truleži.',
        favorableConditions:
            'Zaklonjene gredice, uzastopni uzgoj štitarki, prorjeđivanje koje oslobađa miris i izloženi vrhovi korijena povećavaju rizik tijekom proljetnog i ljetnog leta.',
        severity:
            'Srednje do visoko: čak i kada biljka preživi, hodnici mogu učiniti velik dio korijena neuporabljivim.',
        affectedPlants: [
            'Celer',
            'Komorač',
            'Kopar',
            'Korijandar',
            'Mrkva',
            'Peršin',
        ],
        operations: {
            prevention: ['installInsectProtectionMesh'],
        },
        sources: ['rhsCarrotFly', 'usuVegetablePestGuide'],
    },
    {
        kind: 'pest',
        name: 'Pipa graška i boba',
        shortDescription:
            'Smeđi kornjaš koji na rubovima listova graška i boba ostavlja pravilne polukružne ureze.',
        description:
            'Odrasle pipe hrane se lišćem, dok njihove ličinke u tlu grizu kvržice na korijenu koje vežu dušik. Razvijene biljke obično podnose štetu, ali hladno proljeće i jak napad mogu usporiti mladi usjev.',
        symptoms:
            'Niz pravilnih ureza u obliku slova U duž ruba lista. Sitni sivkastosmeđi odrasli padaju s biljke kada se uznemire, a jako napadnute mlade biljke zaostaju.',
        favorableConditions:
            'Odrasli prezimljuju u zaklonu i u proljeće prelaze na mladi grašak i bob. Hladno i suho vrijeme usporava biljku više nego štetnika pa šteta postaje vidljivija.',
        severity:
            'Nisko do srednje: razvijene biljke uglavnom nadoknade izgubljeno lišće, dok mlade biljke mogu privremeno zastati.',
        affectedPlants: ['Bob', 'Grašak'],
        operations: {
            prevention: ['installInsectProtectionMesh'],
        },
        sources: ['rhsPeaBeanWeevils'],
    },
    {
        kind: 'pest',
        name: 'Graškov moljac',
        shortDescription:
            'Mali moljac čije se gusjenice razvijaju skriveno u mahuni i hrane mladim zrnima graška.',
        description:
            'Ženka polaže jaja na cvatući grašak, a mlada gusjenica ulazi u mahunu prije nego što se šteta može vidjeti izvana. Problem se često otkrije tek pri ljuštenju, pa je važan prije svega kada se beru zrela zrna.',
        symptoms:
            'Unutar mahune nalaze se kremaste gusjenice, izgrizena zrna i nakupine tamnog izmeta. Vanjska strana mahune može izgledati gotovo zdravo.',
        favorableConditions:
            'Let odraslih i cvatnja graška tijekom toplog razdoblja ranog ljeta omogućuju polaganje jaja; prethodno napadnute gredice mogu biti izvor novih odraslih.',
        severity:
            'Nisko za vrlo mlade mahune koje se beru cijele; srednje do visoko za proizvodnju zrna jer se šteta otkriva kasno.',
        affectedPlants: ['Grašak'],
        operations: {
            prevention: ['installInsectProtectionMesh'],
        },
        sources: ['rhsPeaMoth'],
    },
    {
        kind: 'pest',
        name: 'Krumpirova zlatica',
        shortDescription:
            'Prugasti kornjaš i njegove crvenkaste ličinke mogu vrlo brzo pojesti lišće patlidžana.',
        description:
            'Krumpirova zlatica najpoznatija je kao štetnik krumpira, ali patlidžan joj je važan domaćin među biljkama u Gredice katalogu. Odrasli i ličinke hrane se zajedno, pa mala početna skupina može prijeći u naglu defolijaciju.',
        symptoms:
            'Na lišću se vide prugasti žuto-crni odrasli, narančasta jaja u skupinama i mekane crvenkaste ličinke s crnim točkama. Listovi su nepravilno izgrizeni ili ostaju samo deblje žile.',
        favorableConditions:
            'Toplo vrijeme i blizina prethodno uzgajanih pomoćnica pogoduju izlasku prezimjelih odraslih i razvoju nove generacije.',
        severity:
            'Visoko kada su ličinke brojne: mladi patlidžan može u kratkom vremenu ostati bez većine lisne mase.',
        affectedPlants: ['Patlidžan'],
        operations: {
            prevention: ['installInsectProtectionMesh'],
            reduction: ['inspectAndManuallyRemovePests'],
        },
        sources: ['umnColoradoPotatoBeetle'],
    },
    {
        kind: 'pest',
        name: 'Južnoamerički moljac rajčice',
        legacyNames: ['Rajčicin moljac'],
        label: 'Južnoamerički moljac rajčice (Tuta absoluta)',
        shortDescription:
            'Invazivni moljac prisutan u Hrvatskoj čije ličinke miniraju listove rajčice i ubušuju se u stabljike i plodove.',
        description:
            'Rajčicin moljac ima više preklapajućih generacija i može napasti biljku u svim fazama. Rajčica je njegov glavni domaćin; sitne ličinke velik dio razvoja provode zaštićene unutar lista ili ploda, pa je rano prepoznavanje mina važno.',
        symptoms:
            'Nepravilne prozirne mine na listu s tamnim izmetom, hodnici u mladim stabljikama i sitni ulazni otvori na plodu. Zahvaćeni listovi smeđe, a oštećeni plodovi lako sekundarno trunu.',
        favorableConditions:
            'Topli zaštićeni prostori i blage sezone omogućuju brzo nizanje generacija. Ostavljen zaraženi biljni materijal i susjedna rajčica održavaju populaciju.',
        severity:
            'Vrlo visoko: pri jakom napadu ličinke oštećuju lisnu masu i plodove, a populaciju je teško smanjiti nakon što se proširi.',
        affectedPlants: ['Rajčica'],
        operations: {
            prevention: ['installInsectProtectionMesh'],
            reduction: ['hygiene-pruning'],
        },
        sources: ['eppoTomatoLeafMinerCroatia', 'eppoTomatoLeafMinerHosts'],
        reviewNotes: [
            'EPPO potvrđuje prisutnost u Hrvatskoj i navodi rajčicu kao glavnog domaćina; zapis ne pretpostavlja jednaku važnost svih mogućih pomoćnih domaćina.',
        ],
    },
    {
        kind: 'pest',
        name: 'Žuta kukuruzna sovica',
        legacyNames: ['Kukuruzna sovica'],
        label: 'Žuta kukuruzna sovica (Helicoverpa armigera)',
        shortDescription:
            'Polifagna noćna sovica čije se gusjenice hrane cvjetovima, mahunama i plodovima mnogih povrtnih biljaka.',
        description:
            'Kukuruzna sovica selilačka je vrsta prisutna u europskoj i mediteranskoj regiji. Gusjenica radije ulazi u hranjive generativne dijelove biljke, pa vanjska šteta može izgledati mala dok se unutar ploda, mahune ili pupa razvija trulež.',
        symptoms:
            'Okrugli ulazni otvori, izmet oko oštećenja, izgrizeni pupovi i cvjetovi te gusjenica promjenjive zelene, smeđe ili prugaste boje u plodu ili mahuni.',
        favorableConditions:
            'Topla ljeta, doseljavanje odraslih s juga i istodobna cvatnja ili razvoj plodova pogoduju polaganju jaja i šteti.',
        severity:
            'Srednje do visoko: brojnost jako varira među sezonama, ali gusjenice mogu izravno uništiti plodove i otvoriti put sekundarnoj truleži.',
        affectedPlants: [
            'Bamija',
            'Bosiljak',
            'Brokula',
            'Cikla',
            'Dinja',
            'Grah',
            'Grašak',
            'Jagoda',
            'Krastavac',
            'Luk',
            'Mahuna',
            'Paprika',
            'Patlidžan',
            'Rajčica',
            'Tikva',
            'Tikvice',
            'Čili',
            'Špinat',
        ],
        operations: {
            prevention: ['installInsectProtectionMesh'],
            reduction: ['inspectAndManuallyRemovePests', 'hygiene-pruning'],
        },
        sources: ['eppoCottonBollworm'],
        reviewNotes: [
            'Popis prikazuje dokumentirane domaćine iz Gredice kataloga; host-record ne znači da je vrsta jednako česta ili štetna na svakom od njih.',
        ],
    },
    {
        kind: 'pest',
        name: 'Kaduljina i ligurska cikadica',
        shortDescription:
            'Sitne cikadice aromatičnog bilja koje s naličja sišu sok i ostavljaju grubo blijedo točkanje na listu.',
        description:
            'Cikadice roda Eupteryx hrane se na kadulji i srodnim usnačama. Oštećenje je često uočljivije od utjecaja na rast: list ostaje jestiv, ali je išaran, a na naličju se vide kukci i njihove prazne košuljice.',
        symptoms:
            'Mnoštvo nepravilnih blijedih točkica spaja se u mramoriran izgled gornje strane lista. S donje strane mogu se vidjeti sitne zelenkaste cikadice, ličinke i bijele odbačene košuljice.',
        favorableConditions:
            'Odrasli i ličinke aktivni su od proljeća do rane jeseni, a jaja prezimljuju u stabljikama višegodišnjeg aromatičnog bilja.',
        severity:
            'Nisko: čak i jače kasnoljetno točkanje obično malo utječe na rast, ali smanjuje vizualnu kakvoću lista.',
        affectedPlants: [
            'Bosiljak',
            'Kadulja',
            'Matičnjak',
            'Origano',
            'Timijan',
        ],
        operations: {
            reduction: ['rinsePestsFromPlant'],
        },
        sources: ['rhsSageLigurianLeafhoppers'],
    },
    {
        kind: 'pest',
        name: 'Ružmarinova zlatica',
        shortDescription:
            'Metalno prugasti kornjaš i sivkaste ličinke koje izgrizaju listove i cvjetove kadulje, timijana i srodnih biljaka.',
        description:
            'Ružmarinova zlatica potječe iz južne Europe i može se hraniti na više aromatičnih usnača. Na zdravim razvijenim biljkama šteta je često podnošljiva, ali mala biljka ili velika skupina može izgubiti mnogo mladog rasta.',
        symptoms:
            'Sjajni odrasli s uzdužnim zelenim i ljubičastim prugama te sivkaste ličinke nalaze se na vrhovima. Listovi i cvjetovi su izgrizeni, a ostaju posmeđeni kratki dijelovi stabljike.',
        favorableConditions:
            'Hranjenje je često izraženo od kasnog ljeta kroz jesen i ponovno u proljeće; blage zime pogoduju preživljavanju aktivnih stadija.',
        severity:
            'Nisko do srednje: razvijene biljke većinom podnose napad, dok mlade ili male biljke mogu biti vidljivo oslabljene.',
        affectedPlants: ['Kadulja', 'Timijan'],
        operations: {
            reduction: ['inspectAndManuallyRemovePests'],
        },
        reconcileAffectedPlants: true,
        sources: ['rhsRosemaryBeetle'],
    },
    {
        kind: 'pest',
        name: 'Nematode korijenovih kvržica',
        shortDescription:
            'Mikroskopski oblići koji napadaju korijen, stvaraju kvržice i uzrokuju žućenje, zastoj i venuće.',
        description:
            'Nematode roda Meloidogyne žive u tlu i imaju širok krug domaćina. Nadzemni simptomi nalikuju nedostatku hraniva ili vode, pa je pregled opranog korijena i, kod ponavljanog problema, laboratorijska potvrda važnija od procjene samo po lišću.',
        symptoms:
            'Biljka ostaje niska, blijeda i lako vene tijekom toplog dijela dana. Na sitnom i glavnom korijenu nastaju okruglaste do nepravilne kvržice koje se ne skidaju kao čestice zemlje.',
        favorableConditions:
            'Toplo tlo, uzastopni osjetljivi usjevi i korovi domaćini omogućuju rast populacije; nematode se prenose zaraženim tlom i sadnim materijalom.',
        severity:
            'Srednje do visoko: manja populacija ne daje jasan simptom, a jaka zaraza snažno koči rast i teško se uklanja iz tla.',
        affectedPlants: ['Bamija', 'Paprika', 'Patlidžan', 'Rajčica', 'Čili'],
        operations: {
            prevention: ['pullingWeedsPlant'],
            alleviation: ['plantRemoval'],
        },
        sources: ['usuOkra', 'usuRootKnotNematodes'],
    },
] as const satisfies readonly PlantHealthDirectoryIssue[];
