import type {
    PlantHealthDirectoryIssue,
    PlantHealthDirectoryPlantName,
} from './plantHealthDirectory';

const seededPlants = [
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

export const plantHealthDirectoryDiseases = [
    {
        kind: 'disease',
        name: 'Koncentrična pjegavost rajčice',
        legacyNames: ['Rana plamenjača rajčice'],
        shortDescription:
            'Gljivična bolest rajčice koja najčešće počinje na starijem donjem lišću tamnim pjegama s koncentričnim krugovima.',
        description:
            'Koncentrična pjegavost može zahvatiti listove, stabljike i plodove rajčice. U maloj gredici najvažnije je rano uočiti pjege, smanjiti zadržavanje vlage na listu i ukloniti zaraženo lišće prije jačeg širenja.',
        symptoms:
            'Na starijem lišću blizu tla nastaju tamne okrugle pjege. Veće pjege često imaju koncentrične prstenove, okolno tkivo žuti, a jako zaraženi listovi posmeđe i otpadaju ili ostaju suhi na biljci.',
        favorableConditions:
            'Bolesti lista rajčice lakše se šire kada su listovi mokri, uz rosu, prskanje tla po donjem lišću, visoku relativnu vlagu i umjereno toplo vrijeme.',
        severity:
            'Srednje do visoko: rana reakcija obično ograničava štetu, ali jači napad može uzrokovati defolijaciju i ožegotine plodova.',
        affectedPlants: ['Rajčica'],
        operations: {
            reduction: ['hygiene-pruning'],
            alleviation: ['plantRemoval'],
        },
        reconcileOperations: true,
        sources: ['umnEarlyBlightTomatoPotato', 'umnTomatoLeafSpots'],
    },
    {
        kind: 'disease',
        name: 'Pepelnica povrća',
        shortDescription:
            'Skupina gljivičnih bolesti koje stvaraju bijele praškaste prevlake ili svijetle pjege na listovima mnogih vrsta povrća.',
        description:
            'Pepelnicu uzrokuje više srodnih gljivica koje su prilagođene različitim domaćinima. U gredici se najčešće prepoznaje po bijelim praškastim pjegama; kod jačeg napada listovi slabe, žute i prerano odumiru pa biljka teže dozrijeva.',
        symptoms:
            'Bijele praškaste pjege šire se po gornjoj ili donjoj strani lista i na mladim izbojima, a ponekad i cvjetovima ili plodovima. Na rajčici i paprici mogu se prvo vidjeti žute pjege s manje uočljivom prevlakom.',
        favorableConditions:
            'Topli dani, zasjenjen ili gust sklop i slabo strujanje zraka pogoduju razvoju. Za razliku od mnogih lisnih bolesti, pepelnici nije potrebno dugotrajno kvašenje lista.',
        severity:
            'Srednje: često počinje kasnije u sezoni, ali kod osjetljivih biljaka i gustog sklopa može brzo oslabiti lisnu masu.',
        affectedPlants: [
            'Artičoka',
            'Bamija',
            'Blitva',
            'Brokula',
            'Celer',
            'Cikla',
            'Cvjetača',
            'Dinja',
            'Grah',
            'Grašak',
            'Kelj',
            'Kelj pupčar',
            'Koraba',
            'Krastavac',
            'Kupus',
            'Luk',
            'Mahuna',
            'Mrkva',
            'Paprika',
            'Patlidžan',
            'Peršin',
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
            reduction: ['hygiene-pruning'],
        },
        sources: ['ucIpmPowderyMildewVegetables', 'usuPowderyMildewVegetables'],
        reviewNotes: [
            'Ovo je skupni zapis za pepelnice različitih uzročnika; popis domaćina ograničen je na objavljene Gredice biljke navedene u pregledanim tablicama domaćina.',
        ],
    },
    {
        kind: 'disease',
        name: 'Polijeganje presadnica',
        shortDescription:
            'Skupina bolesti mladih biljaka zbog kojih sjeme trune, klice ne niču ili se stabljika sužava i polegne uz tlo.',
        description:
            'Polijeganje najčešće pogađa sjeme, tek iznikle biljke i nježne presadnice. Više gljivica i njima sličnih organizama može izazvati isti obrazac, pa su čisti supstrat, umjereno zalijevanje, toplina i dovoljno zraka važniji od pokušaja prepoznavanja uzročnika po izgledu.',
        symptoms:
            'Sjeme ne niče, klice trunu prije izlaska ili mlada stabljika uz površinu supstrata postaje vodenasta, tanka i tamna. Presadnica naglo polegne, uvene i obično se više ne oporavlja.',
        favorableConditions:
            'Hladan i stalno mokar supstrat, pregusta sjetva, slabo strujanje zraka, prljave posude i ponovna uporaba zaraženog supstrata povećavaju rizik.',
        severity:
            'Visoko za klijance i mlade presadnice: zahvaćena biljka se rijetko oporavlja, a problem se u gustoj sjetvi može brzo širiti.',
        affectedPlants: seededPlants,
        operations: {
            prevention: ['sanitizeSeedlingGrowingArea'],
        },
        sources: ['umnDampingOff'],
        reviewNotes: [
            'Zapis se odnosi na fazu sjemena i presadnice, ne na razvijenu biljku u gredici.',
        ],
    },
    {
        kind: 'disease',
        name: 'Siva plijesan',
        shortDescription:
            'Bolest uzrokovana gljivicom Botrytis koja na oslabljenom ili vlažnom tkivu stvara smeđu trulež i sivu praškastu prevlaku.',
        description:
            'Siva plijesan često počinje na ocvalim cvjetovima, ozlijeđenom tkivu, starom lišću ili plodu koji dugo ostaje vlažan. Na jagodi i rajčici može uništavati cvjetove i plodove, dok na artičoki najčešće ulazi kroz oštećene pricvjetne listove.',
        symptoms:
            'Vodenaste pa smeđe pjege, trulež cvijeta ili ploda i mekano odumrlo tkivo na kojem se za vlažna vremena razvija prepoznatljiva siva, prašnjava masa spora.',
        favorableConditions:
            'Dugotrajna visoka vlaga, kondenzacija, hladnije do umjereno toplo vrijeme, gust sklop, oštećeno tkivo i ostavljeni bolesni plodovi pogoduju zarazi.',
        severity:
            'Srednje do visoko: lokalni napad može se ukloniti, ali u vlažnom sklopu bolest brzo uništava cvjetove i plodove.',
        affectedPlants: ['Artičoka', 'Jagoda', 'Rajčica'],
        operations: {
            reduction: ['hygiene-pruning'],
        },
        sources: [
            'umnGrayMoldTomatoes',
            'umnGrowingStrawberries',
            'ucIpmArtichokeGrayMold',
        ],
    },
    {
        kind: 'disease',
        name: 'Plamenjača rajčice',
        legacyNames: ['Kasna plamenjača rajčice'],
        shortDescription:
            'Brzo napredujuća bolest rajčice koja u hladnijim i vlažnim razdobljima može zahvatiti list, stabljiku i plod.',
        description:
            'Kasnu plamenjaču uzrokuje organizam Phytophthora infestans. Za razliku od sporijih lisnih pjegavosti, povoljni uvjeti mogu dovesti do naglog propadanja cijele biljke, pa sumnjive simptome treba provjeriti rano i ne ostavljati teško zaraženo tkivo među drugim pomoćnicama.',
        symptoms:
            'Nepravilne vodenaste, sivozelene do tamnosmeđe pjege na listovima i stabljikama. Na naličju uz rub pjege za vlažna vremena može nastati bijela prevlaka, a plod dobiva čvrste maslinasto-smeđe lezije.',
        favorableConditions:
            'Dugotrajno vlaženje lista, visoka relativna vlaga i svježe do umjereno toplo vrijeme pogoduju brzom razvoju i širenju spora.',
        severity:
            'Vrlo visoko: u povoljnim uvjetima bolest može uništiti nezaštićenu biljku i zaraziti susjedne rajčice u kratkom roku.',
        affectedPlants: ['Rajčica'],
        operations: {
            reduction: ['hygiene-pruning'],
            alleviation: ['plantRemoval'],
        },
        sources: ['umnLateBlight'],
    },
    {
        kind: 'disease',
        name: 'Bakterijska pjegavost rajčice i paprike',
        shortDescription:
            'Bakterijska bolest koja stvara sitne tamne pjege na listovima i krastave lezije na plodovima rajčice i paprike.',
        description:
            'Uzročnici bakterijske pjegavosti mogu se prenijeti zaraženim sjemenom i presadnicama te kapljicama vode između biljaka. Čili pripada istoj vrsti kao mnoge paprike, pa se u ovom zapisu tretira kao jednako osjetljiv domaćin.',
        symptoms:
            'Na listovima nastaju sitne vodenaste pa tamnosmeđe pjege, često sa žućkastim rubom. Na plodu se pojavljuju uzdignute, hrapave ili krastave pjege; jako zahvaćeno lišće žuti i otpada.',
        favorableConditions:
            'Toplo vrijeme, visoka vlaga, kiša ili zalijevanje po lišću i rad s mokrim biljkama olakšavaju ulazak i širenje bakterija.',
        severity:
            'Srednje do visoko: bolest smanjuje lisnu masu i tržišnu ili uporabnu vrijednost plodova, a teško ju je zaustaviti nakon širenja po nasadu.',
        affectedPlants: ['Paprika', 'Rajčica', 'Čili'],
        operations: {
            reduction: ['hygiene-pruning'],
            alleviation: ['plantRemoval'],
        },
        sources: ['umnBacterialSpotTomatoPepper'],
    },
    {
        kind: 'disease',
        name: 'Fuzarijsko venuće pomoćnica',
        shortDescription:
            'Tlo-prenosiva bolest koja začepljuje provodne žile rajčice, paprike, čilija i patlidžana te uzrokuje postupno venuće.',
        description:
            'Gljivice roda Fusarium ulaze kroz korijen i naseljavaju provodno tkivo. Simptomi se mogu zamijeniti sa sušom ili oštećenjem korijena, ali bolesna biljka nastavlja venuti i uz dovoljno vode; zaraženo tlo može ostati problem više sezona.',
        symptoms:
            'Donji listovi žute, često prvo na jednoj strani biljke, zatim biljka vene tijekom toplog dijela dana i sve se slabije oporavlja. Presjek donjeg dijela stabljike može pokazati smeđe provodno tkivo.',
        favorableConditions:
            'Toplo tlo, osjetljiva sorta, oštećen korijen i uzastopni uzgoj srodnih pomoćnica na istom mjestu povećavaju rizik.',
        severity:
            'Visoko: nakon razvoja sistemskih simptoma biljka se obično ne može izliječiti, a uvenuće i gubitak uroda napreduju.',
        affectedPlants: ['Paprika', 'Patlidžan', 'Rajčica', 'Čili'],
        operations: {
            alleviation: ['plantRemoval'],
        },
        sources: ['umnFusariumWilt'],
        reviewNotes: [
            'Različiti oblici Fusariuma mogu biti specijalizirani za određenog domaćina; zapis opisuje zajednički obrazac venuća, ne laboratorijsku potvrdu vrste.',
        ],
    },
    {
        kind: 'disease',
        name: 'Plamenjača tikvenjača',
        shortDescription:
            'Brza lisna bolest krastavca, dinje, tikve i tikvice koja stvara uglate žute pjege i suši lišće.',
        description:
            'Plamenjača tikvenjača zahvaća prvenstveno listove. Ne mora zaraziti plod izravno, ali gubitak zdrave lisne površine slabi biljku, izlaže plod suncu i može znatno skratiti berbu.',
        symptoms:
            'Na gornjoj strani lista nastaju žute pjege ograničene žilama pa izgledaju uglato. Na naličju se za vlažna vremena može vidjeti sivoljubičasta prevlaka, a pjege se spajaju i cijeli list se suši.',
        favorableConditions:
            'Visoka vlaga, rosa, kiša i višesatno kvašenje lista pogoduju zarazi; bolest se može brzo razvijati kada su noći vlažne, a dani umjereno topli.',
        severity:
            'Visoko: osjetljivi krastavci i dinje mogu brzo izgubiti većinu lisne mase, dok se jačina napada među vrstama i sortama razlikuje.',
        affectedPlants: ['Dinja', 'Krastavac', 'Tikva', 'Tikvice'],
        operations: {
            reduction: ['hygiene-pruning'],
        },
        sources: ['umnDownyMildewCucurbits'],
    },
    {
        kind: 'disease',
        name: 'Crna trulež kupusnjača',
        shortDescription:
            'Bakterijska bolest kupusnjača prepoznatljiva po žutim pjegama u obliku slova V koje napreduju od ruba lista.',
        description:
            'Crna trulež može zaraziti sve jestive kupusnjače i širiti se sjemenom, presadnicama, vodom i radom po mokrim biljkama. Jednom kada uđe u provodno tkivo, uklanjanje pojedinog lista često nije dovoljno.',
        symptoms:
            'Od ruba lista prema sredini nastaju žute zone u obliku slova V, a žile u njima tamne. Listovi venu i suše se; kod presadnica ili jake zaraze može propasti cijela biljka.',
        favorableConditions:
            'Toplo i kišno vrijeme, prskanje vode, ozljede lista i rad među mokrim biljkama olakšavaju širenje bakterije.',
        severity:
            'Visoko: sistemska zaraza može zaustaviti razvoj glavice ili cvata i ostaviti zaražene ostatke kao izvor novog problema.',
        affectedPlants: brassicaPlants,
        operations: {
            alleviation: ['plantRemoval'],
        },
        sources: ['umnBlackRotBrassicas'],
    },
    {
        kind: 'disease',
        name: 'Kila kupusnjača',
        shortDescription:
            'Dugotrajna bolest tla koja deformira korijen kupusnjača u zadebljanja i uzrokuje venuće unatoč vlažnom tlu.',
        description:
            'Uzročnik kile stvara dugovječne spore u tlu i napada korijen biljaka iz porodice kupusnjača. Zaražene biljke slabo usvajaju vodu i hraniva, a premještanje tla može proširiti problem na druge gredice.',
        symptoms:
            'Biljka za toplog dana vene, slabo raste i može imati žućkasto lišće. Na iskopanom korijenu vide se nepravilna vretenasta ili kvrgava zadebljanja koja kasnije tamne i trunu.',
        favorableConditions:
            'Vlažno, slabo drenirano i kiselo tlo te čest uzgoj kupusnjača na istom mjestu pogoduju razvoju i nakupljanju inokuluma.',
        severity:
            'Vrlo visoko: zahvaćena biljka daje slab ili nikakav urod, a zaraženo tlo može ostati rizično mnogo godina.',
        affectedPlants: brassicaPlants,
        operations: {
            alleviation: ['plantRemoval'],
        },
        sources: ['umnClubroot'],
    },
    {
        kind: 'disease',
        name: 'Bakterijske pjegavosti i paleži graha',
        shortDescription:
            'Skupina bakterijskih bolesti graha i mahune koje uzrokuju vodenaste pjege, sušenje lista i oštećenja mahuna.',
        description:
            'Nekoliko bakterija na grahu stvara slične simptome, pa ih bez stručne dijagnostike nije uvijek moguće razlikovati. Zaraženo sjeme, biljni ostaci i kapljice vode važni su izvori širenja u maloj gredici.',
        symptoms:
            'Na listovima se pojavljuju sitne vodenaste pa smeđe pjege, često okružene žutim rubom. Pjege se mogu spajati u palež; na mahunama nastaju udubljene ili masne lezije, ponekad s iscjetkom.',
        favorableConditions:
            'Toplo, vlažno i kišno vrijeme, zalijevanje po lišću i dodirivanje mokrih biljaka pogoduju prijenosu bakterija.',
        severity:
            'Srednje do visoko: lokalne pjege smanjuju lisnu površinu, a jača zaraza oštećuje mahune i može zaraziti sjeme.',
        affectedPlants: ['Grah', 'Mahuna'],
        operations: {
            reduction: ['hygiene-pruning'],
            alleviation: ['plantRemoval'],
        },
        sources: ['umnGrowingBeans'],
    },
    {
        kind: 'disease',
        name: 'Fuzarijsko venuće graška',
        shortDescription:
            'Tlo-prenosiva bolest graška koja uzrokuje žućenje, zaostajanje u rastu i trajno venuće biljke.',
        description:
            'Fusarium ulazi kroz korijen graška i širi se provodnim tkivom. Problem se često pojavljuje u žarištima i može se ponavljati na istoj gredici, osobito kada se grašak ili bliski srodnici uzgajaju prečesto.',
        symptoms:
            'Donji listovi žute, biljka zaostaje, vene i na kraju se suši. Na uzdužno prerezanoj stabljici ili korijenu može se vidjeti crvenkasto do smeđe obojeno provodno tkivo.',
        favorableConditions:
            'Zaraženo tlo, osjetljiva sorta, toplije tlo i oštećenja korijena povećavaju rizik; spore mogu dugo preživjeti bez usjeva.',
        severity:
            'Visoko: zaražena biljka se uglavnom ne oporavlja, a trajnost uzročnika u tlu otežava ponovni uzgoj graška.',
        affectedPlants: ['Grašak'],
        operations: {
            alleviation: ['plantRemoval'],
        },
        sources: ['usuPeas'],
    },
    {
        kind: 'disease',
        name: 'Čokoladna pjegavost boba',
        shortDescription:
            'Gljivična bolest boba koja stvara crvenkastosmeđe do čokoladne pjege na listovima, stabljikama i cvjetovima.',
        description:
            'Čokoladna pjegavost može ostati ograničena na sitne pjege ili, u dugotrajno vlažnim uvjetima, prijeći u agresivnu palež. Gusto posađen bob i ostaci zaraženih biljaka povećavaju pritisak bolesti.',
        symptoms:
            'Brojne okrugle crvenkastosmeđe pjege, često sa sivljim središtem, pojavljuju se na lišću. Kod jačeg napada pjege se spajaju, stabljike i cvjetovi tamne, a listovi venu i otpadaju.',
        favorableConditions:
            'Visoka vlaga, dugotrajno kvašenje lista, blago do umjereno toplo vrijeme i gust sklop pogoduju razvoju.',
        severity:
            'Srednje do visoko: blaži napad uglavnom oštećuje lišće, dok agresivna palež može zaustaviti cvatnju i nalijevanje mahuna.',
        affectedPlants: ['Bob'],
        operations: {
            reduction: ['hygiene-pruning'],
        },
        sources: ['rhsBroadBeans'],
    },
    {
        kind: 'disease',
        name: 'Plamenjača luka',
        shortDescription:
            'Bolest jestivih lukova koja na lišću stvara blijede izdužene zone i sivoljubičastu prevlaku te slabi razvoj lukovice.',
        description:
            'Plamenjača može zahvatiti luk, češnjak, poriluk i vlasac. Zaraženo lišće postupno propada, a bolest se u vlažnom sklopu može širiti neupadljivo prije nego što veći dio reda pokaže simptome.',
        symptoms:
            'Na listovima nastaju blijedozelene do žute izdužene pjege. Za vlažna jutra na njima se vidi sivkasta ili ljubičasta pahuljasta prevlaka, nakon čega se list savija, žuti i suši.',
        favorableConditions:
            'Hladnije do umjereno toplo vrijeme, visoka noćna vlaga, rosa i slabo strujanje zraka pogoduju sporulaciji i širenju.',
        severity:
            'Srednje do visoko: rano propadanje lišća smanjuje razvoj lukovice, a jači napad može uništiti velik dio nadzemne mase.',
        affectedPlants: alliumPlants,
        operations: {
            reduction: ['hygiene-pruning'],
        },
        sources: ['umnOnionDiagnosis'],
    },
    {
        kind: 'disease',
        name: 'Hrđa poriluka i češnjaka',
        shortDescription:
            'Gljivična bolest jestivih lukova koja stvara narančaste praškaste jastučiće na listovima.',
        description:
            'Hrđa je osobito česta na poriluku i češnjaku, ali može zahvatiti i luk te vlasac. Manji broj pjega obično ne ugrožava biljku, dok jak i rani napad smanjuje fotosintezu i kakvoću lisnatog dijela.',
        symptoms:
            'Na obje strane lista nastaju sitni narančasti do hrđastosmeđi praškasti jastučići. Okolno tkivo žuti, a kod jakog napada list se suši od vrha prema bazi.',
        favorableConditions:
            'Dulja razdoblja visoke vlage, rosa, pregust sklop i bujan mekan rast pogoduju klijanju spora i ponavljanim zarazama.',
        severity:
            'Nisko do srednje u kasnom ili slabom napadu; visoko kada se bolest rano proširi po većini listova.',
        affectedPlants: alliumPlants,
        operations: {
            reduction: ['hygiene-pruning'],
        },
        sources: ['rhsChives'],
    },
    {
        kind: 'disease',
        name: 'Cerkosporna pjegavost cikle, blitve i špinata',
        shortDescription:
            'Lisna bolest cikle, blitve i špinata koja stvara brojne male okrugle pjege sa svijetlim središtem i tamnim rubom.',
        description:
            'Cercospora uzrokuje vrlo sličan obrazac pjegavosti na cikli, blitvi i špinatu. Više ciklusa zaraze tijekom toplog i vlažnog razdoblja može brzo smanjiti uporabnu lisnu masu.',
        symptoms:
            'Na lišću nastaju sitne okrugle pjege sa sivim ili svijetlosmeđim središtem i crvenkastim do tamnim rubom. Pjege se spajaju, središta mogu ispasti, a jako zahvaćeni listovi žute i suše se.',
        favorableConditions:
            'Toplo vrijeme, visoka relativna vlaga, česte rose ili kiše, zaraženi ostaci i gust sklop pogoduju razvoju.',
        severity:
            'Srednje do visoko: na blitvi izravno smanjuje berivu lisnu masu, a na cikli rano i jako oštećenje lišća slabi korijen.',
        affectedPlants: ['Blitva', 'Cikla', 'Špinat'],
        operations: {
            reduction: ['hygiene-pruning'],
        },
        sources: ['umnBeetLeafSpots', 'umassCercosporaLeafSpot'],
    },
    {
        kind: 'disease',
        name: 'Plamenjača salate',
        shortDescription:
            'Bolest salate koja uzrokuje uglate žute pjege i bijelu pahuljastu prevlaku na naličju lista.',
        description:
            'Plamenjača se može pojaviti od presadnice do razvijene glavice. Oštećuje upravo dio biljke koji se jede, a lezije mogu postati ulaz za sekundarne truleži.',
        symptoms:
            'Na gornjoj strani lista nastaju blijedozelene do žute pjege ograničene žilama. Na naličju se za vlažnih jutara vidi bijela do sivkasta prevlaka; pjege kasnije posmeđe i postaju papirnate.',
        favorableConditions:
            'Hladnije i vlažno vrijeme, duga rosa, zalijevanje po lišću i gust sklop pogoduju zarazi i sporulaciji.',
        severity:
            'Srednje do visoko: i manji broj pjega smanjuje uporabljivost lista, a jak napad može uništiti cijelu glavicu.',
        affectedPlants: ['Salata'],
        operations: {
            reduction: ['hygiene-pruning'],
        },
        sources: ['umnLettuceDiseases'],
    },
    {
        kind: 'disease',
        name: 'Žutilo astera',
        shortDescription:
            'Bolest koju prenose cikade, a uzrokuje žućenje, zakržljalost i izobličene cvjetove ili korijen na više vrsta povrća.',
        description:
            'Žutilo astera uzrokuje fitoplazma koja živi u provodnom tkivu i prenosi se hranjenjem zaraženih cikada. Zaražena biljka ostaje izvor za prijenos i ne može se izliječiti uklanjanjem pojedinog lista.',
        symptoms:
            'Nova lisna masa blijedi ili žuti, rast ostaje zbijen i izobličen, a cvjetovi mogu ozelenjeti i ne razviti normalan plod. Mrkva često stvara mnoštvo tankih korjenčića i gorak, deformiran korijen.',
        favorableConditions:
            'Veći broj cikada prijenosnika, toplo i suho vrijeme koje potiče njihovo kretanje te prisutnost zaraženih korova povećavaju rizik.',
        severity:
            'Visoko za zahvaćenu biljku: nema kurativnog postupka, kvaliteta uroda snažno pada, a biljka može širiti uzročnika dalje.',
        affectedPlants: ['Celer', 'Luk', 'Mrkva', 'Salata', 'Češnjak'],
        operations: {
            alleviation: ['plantRemoval'],
        },
        sources: ['umnAsterYellows'],
    },
    {
        kind: 'disease',
        name: 'Pjegavosti lista jagode',
        shortDescription:
            'Skupina gljivičnih bolesti jagode koje stvaraju ljubičaste, smeđe ili svijetle pjege i prerano suše lišće.',
        description:
            'Pjegavost, opaljenost i palež lista jagode mogu izgledati različito, ali sve prezimljuju na zaraženom lisnom tkivu i šire se kapljicama vode. Zapis služi za prepoznavanje skupine; točan uzročnik često zahtijeva stručni pregled.',
        symptoms:
            'Na listovima se pojavljuju sitne ljubičaste pjege, pjege sa svijetlim središtem ili veće crvenkastosmeđe zone. Peteljke i vriježe također mogu dobiti tamne lezije, a jako zahvaćeno lišće se suši.',
        favorableConditions:
            'Česte kiše ili zalijevanje po lišću, dugotrajna vlaga, stari zaraženi listovi i gust sklop pogoduju ponovljenim zarazama.',
        severity:
            'Nisko do srednje kod nekoliko pjega; visoko kada se rano izgubi veći dio lisne mase i oslabi stvaranje plodova ili novih pupova.',
        affectedPlants: ['Jagoda'],
        operations: {
            reduction: ['hygiene-pruning'],
        },
        sources: ['umnGrowingStrawberries'],
    },
    {
        kind: 'disease',
        name: 'Plamenjača bosiljka',
        shortDescription:
            'Ozbiljna bolest bosiljka koja prvo uzrokuje žućenje između žila, a zatim tamnu pahuljastu prevlaku na naličju lista.',
        description:
            'Plamenjača bosiljka može nalikovati nedostatku hraniva dok se ne pregleda naličje lista. Brzo smanjuje uporabnu lisnu masu i lako se širi sporama među gusto posađenim biljkama.',
        symptoms:
            'Gornja strana lista žuti u uglatim poljima omeđenim žilama. Na naličju se razvija siva do tamnoljubičasta pahuljasta prevlaka; list zatim smeđi, uvija se i otpada.',
        favorableConditions:
            'Visoka vlaga, dugotrajno vlažno lišće, hladnije noći, gust sklop i slabo strujanje zraka pogoduju razvoju.',
        severity:
            'Visoko: bolest može u kratkom roku učiniti većinu lišća neuporabljivom, a jako zaraženu biljku nije moguće vratiti u zdravo stanje.',
        affectedPlants: ['Bosiljak'],
        operations: {
            reduction: ['hygiene-pruning'],
            alleviation: ['plantRemoval'],
        },
        sources: ['umnBasilDownyMildew'],
    },
    {
        kind: 'disease',
        name: 'Trulež korijena bamije',
        shortDescription:
            'Skupina bolesti tla koje oštećuju korijen i bazu stabljike bamije te uzrokuju žućenje, zastoj i venuće.',
        description:
            'Različiti uzročnici mogu izazvati isti sindrom truleži korijena bamije. Potvrda samo po nadzemnim simptomima nije pouzdana, ali pregled korijena i uvjeta u tlu pomaže razlikovati problem od običnog nedostatka vode.',
        symptoms:
            'Biljka zaostaje, listovi blijede ili žute i venu iako je tlo vlažno. Korijen je smeđ, mekan ili raspadnut, a korijenov vrat može biti taman i sužen.',
        favorableConditions:
            'Stalno mokro i slabo drenirano tlo, hladan supstrat u fazi nicanja, preduboka sadnja i oštećen korijen povećavaju rizik.',
        severity:
            'Srednje do visoko: rano popravljanje uvjeta može pomoći slabo zahvaćenoj biljci, ali opsežno istrunuo korijen uglavnom se ne oporavlja.',
        affectedPlants: ['Bamija'],
        operations: {
            alleviation: ['plantRemoval'],
        },
        sources: ['usuOkra'],
        reviewNotes: [
            'Skupni zapis opisuje sindrom više mogućih uzročnika, ne laboratorijski potvrđenu pojedinačnu bolest.',
        ],
    },
    {
        kind: 'disease',
        name: 'Trulež korijena začinskog bilja',
        shortDescription:
            'Skupina bolesti koja u prevlažnom supstratu oštećuje korijen aromatičnog bilja i uzrokuje slabljenje, žućenje i venuće.',
        description:
            'Različite gljivice i njima slični organizmi mogu izazvati isti obrazac truleži korijena. Kod začinskog bilja problem je čest u posudi ili zbijenoj gredici koja ostaje mokra dulje nego što vrsta podnosi.',
        symptoms:
            'Izboji slabe, listovi blijede ili žute i venu, a rast se zaustavlja. Korijen postaje smeđ i mekan, vanjski sloj se lako odvaja, a baza stabljike može potamniti.',
        favorableConditions:
            'Stalno mokar i slabo dreniran supstrat, preduboka sadnja, prevelika posuda, zbijen korijenov prostor i zimska zasićenost vodom povećavaju rizik.',
        severity:
            'Srednje do visoko: početno oštećenje može se ograničiti poboljšanjem uvjeta, ali biljka s većinom istrunulog korijena rijetko se oporavlja.',
        affectedPlants: [
            'Bosiljak',
            'Kadulja',
            'Kamilica',
            'Komorač',
            'Kopar',
            'Korijandar',
            'Ljupčac',
            'Luk vlasac',
            'Matičnjak',
            'Origano',
            'Peršin',
            'Timijan',
        ],
        operations: {
            alleviation: ['plantRemoval'],
        },
        sources: [
            'umnGrowingHerbs',
            'ucIpmRootStemCrownRots',
            'usuGrowingBasil',
        ],
        reconcileSources: true,
        reviewNotes: [
            'Skupni zapis opisuje sindrom; ponavljani problem treba dijagnostički potvrditi prije odabira specifične zaštite.',
        ],
    },
    {
        kind: 'disease',
        name: 'Plamenjača špinata',
        shortDescription:
            'Bolest špinata koja na gornjoj strani lista stvara žute uglate pjege, a na naličju prolaznu sivkastu prevlaku.',
        description:
            'Plamenjaču špinata uzrokuje domaćinu prilagođen organizam i zato je odvojena od plamenjače salate ili bosiljka. Napada upravo jestivi list i može se brzo širiti među gusto posađenim biljkama.',
        symptoms:
            'Na starijem lišću prvo nastaju nepravilne žute pjege. Dok je list vlažan, na naličju se vidi bijela do sivoljubičasta pahuljasta prevlaka; lezije zatim postaju smeđe, suhe ili trule.',
        favorableConditions:
            'Hladno i gotovo zasićeno vlažno vrijeme, slobodna voda na listu, gusta sjetva i slabo strujanje zraka pogoduju zarazi.',
        severity:
            'Visoko: zahvaćeni list gubi uporabnu vrijednost, a jaka zaraza može uništiti većinu lisne mase.',
        affectedPlants: ['Špinat'],
        operations: {
            reduction: ['hygiene-pruning'],
        },
        sources: ['ucIpmSpinachDownyMildew'],
    },
    {
        kind: 'disease',
        name: 'Bakterijska pjegavost korijandra i peršina',
        shortDescription:
            'Bakterijska bolest koja na listovima korijandra i peršina stvara vodenaste uglate pjege te prelazi u suhu palež.',
        description:
            'Uzročnici se mogu prenijeti sjemenom, zaraženim ostacima i kapljicama vode. Budući da se kod obje biljke bere list, i umjeren napad može znatno smanjiti uporabni dio usjeva.',
        symptoms:
            'Sitne vodenaste pjege ograničene žilama postaju žutosmeđe, smeđe ili gotovo crne. Središte se suši i postaje papirnato, a spojene pjege mogu zahvatiti cijele liske.',
        favorableConditions:
            'Kiša, zalijevanje po lišću, jaka rosa ili magla, visoka vlaga i rad među mokrim biljkama pogoduju širenju.',
        severity:
            'Srednje do visoko: biljka može nastaviti rasti, ali jako pjegav ili spaljen list nije prikladan za berbu.',
        affectedPlants: ['Korijandar', 'Peršin'],
        operations: {
            reduction: ['hygiene-pruning'],
        },
        sources: ['ucIpmCilantroParsleyBacterialLeafSpot'],
    },
    {
        kind: 'disease',
        name: 'Fuzarijsko venuće salate i matovilca',
        shortDescription:
            'Tlo-prenosiva bolest koja uzrokuje žućenje, zastoj, smeđenje provodnog tkiva i propadanje salate ili matovilca.',
        description:
            'Fusarium oxysporum f. sp. lactucae napada salatu, a EPPO među glavnim domaćinima navodi i matovilac. Uzročnik se može prenositi zaraženim sadnim materijalom i tlom te ostati prisutan nakon uklanjanja bolesne biljke.',
        symptoms:
            'Vanjski listovi žute i venu, biljka ostaje niska, a korijenov vrat i gornji korijen dobivaju crvenkastosmeđu nekrozu. Presjek baze može pokazati smeđe provodno tkivo.',
        favorableConditions:
            'Toplije tlo, ponavljani uzgoj osjetljivih salata, zaražene presadnice te prijenos zemlje alatom, vodom ili obućom povećavaju rizik.',
        severity:
            'Visoko za zahvaćenu biljku: razvoj glavice ili rozete prestaje, a biljka često ugine prije berbe.',
        affectedPlants: ['Matovilac', 'Salata'],
        operations: {
            alleviation: ['plantRemoval'],
        },
        sources: ['eppoFusariumLettuce'],
        reviewNotes: [
            'EPPO potvrđuje europske nalaze i domaćine, ali ovaj zapis ne tvrdi da je bolest česta ili potvrđena u svakoj hrvatskoj gredici.',
        ],
    },
    {
        kind: 'disease',
        name: 'Vaskularno venuće bamije',
        shortDescription:
            'Sistemsko venuće bamije pri kojem biljka žuti i propada, a provodno tkivo stabljike postaje smeđe.',
        description:
            'Fusarium i Verticillium mogu na bamiji dati vrlo slične vanjske simptome. Zbog toga zapis opisuje vaskularno venuće kao dijagnostičku skupinu; točan uzročnik ne treba zaključiti bez pregleda provodnog tkiva i, po potrebi, laboratorijske potvrde.',
        symptoms:
            'Jedan dio ili cijela biljka žuti, vene unatoč vlažnom tlu i postupno se ruši. U uzdužno prerezanoj stabljici vide se smeđe pruge ili točkasta diskoloracija provodnih žila.',
        favorableConditions:
            'Zaraženo tlo, uzastopni osjetljivi usjevi i oštećen korijen povećavaju rizik. Topliji uvjeti češće pogoduju Fusariumu, a hladniji Verticilliumu.',
        severity:
            'Visoko: kada je provodni sustav znatno zahvaćen, biljka se uglavnom ne oporavlja i daje vrlo malo ili nimalo mahuna.',
        affectedPlants: ['Bamija'],
        operations: {
            alleviation: ['plantRemoval'],
        },
        sources: ['arkansasOkraWilt'],
        reviewNotes: [
            'Vidljivi simptomi ne razlikuju pouzdano Fusarium od Verticilliuma; naziv je namjerno sindromski.',
        ],
    },
    {
        kind: 'disease',
        name: 'Bijela trulež povrća',
        shortDescription:
            'Bolest koja na stabljici, listu ili plodu stvara vodenastu trulež, bijelu pamučastu prevlaku i tvrda crna tjelešca.',
        description:
            'Bijelu trulež uzrokuju gljivice roda Sclerotinia s vrlo širokim krugom domaćina. Tvrdi crni sklerociji mogu preživjeti u tlu, a zaraza često počinje na starom cvijetu ili vlažnom tkivu blizu tla.',
        symptoms:
            'Vodenaste lezije prelaze u mekanu svijetlu trulež. Na površini nastaje obilna bijela pamučasta prevlaka, a unutar ili na stabljici tvrde crne tvorevine; dio biljke iznad lezije naglo vene.',
        favorableConditions:
            'Hladnije do umjereno toplo i dugo vlažno vrijeme, gusto lišće, slabo strujanje zraka, staro cvjetno tkivo i zaraženo tlo pogoduju bolesti.',
        severity:
            'Visoko: lezija na stabljici može prekinuti dovod vode i uništiti cijeli izboj, a sklerociji dugotrajno onečišćuju tlo.',
        affectedPlants: [
            'Grah',
            'Kupus',
            'Mahuna',
            'Mrkva',
            'Rajčica',
            'Salata',
            'Tikva',
            'Tikvice',
        ],
        operations: {
            reduction: ['hygiene-pruning'],
            alleviation: ['plantRemoval'],
        },
        sources: ['umnWhiteMoldGarden', 'umnWhiteMoldCucurbits'],
    },
    {
        kind: 'disease',
        name: 'Bijela trulež luka',
        shortDescription:
            'Dugotrajna bolest tla zbog koje listovi jestivih lukova žute i venu, a baza lukovice trune pod bijelom prevlakom.',
        description:
            'Uzročnik bijele truleži specijaliziran je za jestive lukove. Sitni crni sklerociji ostaju u tlu mnogo godina, pa je rano prepoznavanje i sprječavanje prijenosa zaražene zemlje osobito važno.',
        symptoms:
            'Listovi od vrha žute, venu i odumiru. Korijen i baza lukovice trunu, prekriva ih bijela pahuljasta prevlaka, a među njom se vide sitne crne kuglice nalik maku.',
        favorableConditions:
            'Hladnije do umjereno toplo i vlažno tlo potiče klijanje sklerocija u blizini korijena luka; premještanje zemlje i zaraženih lukovica širi problem.',
        severity:
            'Vrlo visoko: zaražena biljka obično propada, a tlo može ostati rizično za luk, češnjak, poriluk i vlasac mnogo sezona.',
        affectedPlants: alliumPlants,
        operations: {
            alleviation: ['plantRemoval'],
        },
        sources: ['rhsOnionWhiteRot'],
    },
    {
        kind: 'disease',
        name: 'Pjegavosti lista mrkve',
        shortDescription:
            'Skupina bolesti mrkve koje na starijim listovima i peteljkama stvaraju smeđe pjege te mogu osušiti cijelu lisnu rozetu.',
        description:
            'Alternaria i Cercospora mogu na mrkvi izazvati sličnu palež lišća. Bez stručnog pregleda uzročnike nije uvijek moguće razlikovati, ali oba problema smanjuju fotosintezu i otežavaju berbu korijena kada peteljke oslabe.',
        symptoms:
            'Na starijem lišću nastaju sitne smeđe do crne pjege, često sa žutim rubom. Pjege se spajaju, peteljke dobivaju izdužene lezije, a cijeli list može pocrnjeti i polegnuti.',
        favorableConditions:
            'Toplo i vlažno vrijeme, duga rosa, kiša ili zalijevanje po lišću, gust sklop i zaraženi biljni ostaci pogoduju razvoju.',
        severity:
            'Srednje: korijen često ostaje jestiv, ali jaka i rana palež smanjuje rast i može znatno otežati čupanje i berbu.',
        affectedPlants: ['Mrkva'],
        operations: {
            reduction: ['hygiene-pruning'],
        },
        sources: ['umnCarrotLeafSpots'],
    },
    {
        kind: 'disease',
        name: 'Plamenjača kupusnjača',
        shortDescription:
            'Bolest kupusnjača koja stvara žute pjege i bijelu pahuljastu prevlaku, osobito na presadnicama i donjem lišću.',
        description:
            'Plamenjaču kupusnjača uzrokuje domaćinu prilagođen organizam koji može napasti sve jestive članove porodice. Mlade biljke i gusto uzgojene presadnice mogu biti mnogo osjetljivije od razvijenih biljaka.',
        symptoms:
            'Na gornjoj strani lista nastaju žute do smeđe nepravilne pjege, a na naličju bijela ili sivkasta pahuljasta prevlaka. Zahvaćeni list se suši, dok na nekim glavicama nastaju tamne unutarnje pjege.',
        favorableConditions:
            'Hladno i vlažno vrijeme, dugotrajna rosa, pregusta sjetva i slabo strujanje zraka pogoduju sporulaciji i širenju.',
        severity:
            'Srednje do visoko: razvijena biljka može podnijeti manji napad, ali presadnice i jestivi listovi mogu biti teško oštećeni.',
        affectedPlants: brassicaPlants,
        operations: {
            reduction: ['hygiene-pruning'],
        },
        sources: ['rhsBrassicaDownyMildew'],
    },
] as const satisfies readonly PlantHealthDirectoryIssue[];
