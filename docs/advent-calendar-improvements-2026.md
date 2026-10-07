# Prijedlozi za unapređenje adventskog kalendara

Uredan zadatak: `2828593d-1403-45a6-b9bb-0ce555906f2b` — **Unaprijedi adventski kalendar**.

Pripremljeno 4. listopada 2026. na temelju postojeće implementacije u Gredicama, revizija `9c37abc44`. Ovo su prijedlozi i interaktivni dizajnerski koncepti; nova sezona i nagrade nisu aktivirane.

**Odabrani smjer za daljnju razradu: Zimski vrt (opcija 2).** Nakon pregleda korisnik je odabrao taj koncept i zatražio raznovrsnija, razigranija vratašca prekrivena snijegom odozgo te dnevni i noćni izgled usklađen s vremenom u igri. Treći pregled dodatno određuje čitljive prijelaze svjetla, proziran mjesec i zvijezde, prilagođene snježne rubove, zlatnu ulaznicu za 24. dan te uklanjanje dodatnog CTA-a, napretka/legende i izbornika smjerova. Četvrti pregled traži usklađenu geometriju snijega i polja, centrirane statusne simbole, jednostavniju mrežu bez naslova te pozadinske zvijezde preko cijele scene uz nježno treperenje. Izvorna usporedba sačuvana je u [prvoj verziji prototipa](../output/design-mocks/advent-calendar-2026/index-v1.html).

## Što već imamo

- Kalendar s 24 polja u izmiješanom rasporedu, s većim poljem za 24. dan, blagdanskim uzorcima i maskotom suncokreta.
- Dva uvodna ekrana, prikaz pojedinačnih nagrada, pregled ranije otvorenog dana i poruku za propušteni dan.
- HUD podsjetnik u vrtu. Otvaranja i nagrade pripadaju računu, pa više članova računa dijeli isti napredak.
- Drvce `PineAdvent` već dobiva kuglice i lampice prema broju otvorenih dana, a zvijezdu nakon otvaranja 24. dana.
- Povijesni model nagrada uključuje ukrase, biljke, suncokrete i završni poklon. U implementaciji 2025. fizički poklon vezan je uz svih 24 otvorenih dana; to ne utvrđuje ponudu ili pravila za 2026.

**Polazište za novu sezonu:** HUD i klijentski pozivi vezani su uz 2025. Povijesna ruta za otvaranje u kodu vraća `410 ADVENT_CALENDAR_CLOSED`. Javni [pregled adventa](https://api.gredice.com/api/occasions/advent) 4. listopada 2026. vratio je HTTP 200 i samo `calendar-2025`. U ovom pregledu nisu izvršavane produkcijske mutacije niti provjeravana autentificirana povijest korisnika. Prikazi za prosinac 2026. koriste demonstracijske podatke.

## 10 prijedloga za unapređenje

Prioriteti: **P0** = potrebno prije nove sezone; **P1** = osnovni paket poboljšanja; **P2** = proširenje nakon osnovnog paketa. Opseg je relativan: mali, srednji ili veliki; nije procjena u radnim danima.

### 1. Pripremiti kalendar za svaku novu sezonu

**Problem:** godina, ruta, query ključ, HUD razdoblje i poveznica na pravila trenutno su vezani uz 2025.

**Prijedlog:** aktivna kampanja definira godinu, početak i završetak, vremensku zonu, pravila i katalog nagrada. UI razlikuje „Uskoro”, „Aktivno” i „Završeno”, a stari kalendari ostaju dostupni za pregled povijesti. Sezona se objavljuje tek kad su ponuda i pravila spremni.

**Kriterij prihvata:** nova kampanja ne otvara nagrade iz 2025.; napredak i predmemorija odvojeni su po računu i kampanji. Poslužitelj određuje dostupni dan i vrijeme sljedećeg otvaranja. Rubni datumi i različite vremenske zone imaju provjerene ishode.

**P0 · veliki opseg.**

### 2. Učiniti današnje polje očitim

**Problem:** današnji broj treba pronaći među 24 izmiješana polja, a zatvorena polja imaju vrlo sličan tretman.

**Prijedlog:** današnje polje ima jasan obrub i oznaku „Danas”; poklon se otvara samo klikom na to polje, prema korisnikovoj odluci u trećoj iteraciji. Prema petom pregledu, otvoreno polje ima poderanu oznaku broja i nema snijega; buduće polje ima netaknutu oznaku pod snijegom, a propušteno prigušen tretman. Ponavljane oznake „Otvoreno”, „Uskoro” i „Propušteno” uklanjaju se iz vizualnog prikaza, dok dostupni naziv gumba zadržava datum i puni status. Odabrani Zimski vrt koristi kronološki raspored. Dodatni naslovi s rasponom prosinca i današnjim brojem iznad mreže uklanjaju se prema četvrtom pregledu.

**Kriterij prihvata:** današnje polje jasno se prepoznaje u mreži i otvara jednim klikom; nema dodatnog gumba za otvaranje izvan mreže. Nakon otvaranja prikazuje „Današnji poklon je dodan” i vrijeme sljedećeg otvaranja. Buduće polje objašnjava kada stiže, umjesto da odgovori samo njihajućom animacijom.

**P1 · mali opseg.**

### 3. Skratiti prvi dolazak i zadržati dostupna pravila

**Problem:** prvi dolazak vodi preko dva uvodna ekrana prije prikaza kalendara.

**Prijedlog:** jedan kratak uvod s maskotom, sažetkom „Jedno polje dnevno” i jasnom poveznicom na pravila aktualne kampanje. Nastavak uvoda vodi do mreže; otvaranje poklona događa se isključivo na polju. Pravila ostaju dostupna i nakon uvoda. Korisnik koji je već sudjelovao odmah dobiva kalendar.

**Kriterij prihvata:** povratni dolazak ne vraća korisnika na uvod zbog nedovršenog učitavanja podataka. Ponašanje prihvaćanja pravila nove kampanje određuje se prema objavljenim uvjetima te se ne mijenja samo vizualnim redizajnom.

**P1 · mali opseg.**

### 4. Jasno pokazati stvarne uvjete završnog poklona

**Problem:** uvod može stvoriti očekivanje završnog boxa bez dovoljno jasnog razlikovanja ishoda.

**Prijedlog:** za fizičku nagradu, ako je nova kampanja uopće uključuje, prikazati točan status prema poslužitelju: ostvarivo, ostvareno ili uvjeti nisu ispunjeni. Digitalne nagrade i fizička isporuka imaju zasebna objašnjenja. Korisnik je u trećoj iteraciji uklonio brojač otvorenih polja, traku napretka i legendu iz kalendara; status svakog dana ostaje na samom polju.

**Kriterij prihvata:** prikaz nakon propuštenog dana ne obećava fizički poklon koji korisnik više ne može ostvariti. Otvoreni dani, preostali budući dani i uvjeti nagrade nisu predstavljeni kao ista brojka.

**P1 · srednji opseg.**

### 5. Omogućiti jedan oprošteni propušteni dan

**Problem:** propušteni dan danas trajno istječe, a poruka sa tužnim emotikonom naglašava gubitak. U starim pravilima to utječe i na završni fizički poklon.

**Prijedlog:** za buduću kampanju razmotriti jednu besplatnu nadoknadu propuštenog dana, dostupnu prije završetka kampanje. Ako se zadrže stroga pravila, barem promijeniti poruku u „Ovo je polje završilo. Današnji poklon te još čeka” s izravnim povratkom na današnje polje.

**Kriterij prihvata:** prije izvedbe odrediti rok, koje se nagrade mogu nadoknaditi, učinak na završni poklon i ograničenje jednom po računu i kampanji. Nadoknada se priznaje na poslužitelju i ne može dodijeliti istu nagradu dvaput. Postojeća pravila 2025. ostaju povijesna.

**P2 · srednji do veliki opseg; odluka o pravilima nove kampanje.**

### 6. Dodati podsjetnik koji korisnik sam bira

**Problem:** postojeća poruka u HUD-u dopire do korisnika tek kad je već u vrtu.

**Prijedlog:** ponuditi „Podsjeti me na današnje polje”, s odabirom dostupnog kanala i vremena. Obavijest vodi na aktualni kalendar. Dnevni podsjetnik prestaje nakon otvaranja, završetka kampanje ili isključivanja postavke.

**Kriterij prihvata:** slanje počinje tek nakon izričitog uključivanja; podsjetnik poštuje vremensku zonu i uklanja duplikate na zajedničkom računu. Isključivanje je dostupno iz postavke podsjetnika. Osloniti se na postojeće postavke i infrastrukturu obavijesti.

**P2 · srednji opseg.**

### 7. Nakon nagrade pokazati gdje je i što mogu s njom

**Problem:** nagrada je već dodijeljena prije ekrana s gumbom „Preuzmi”, što može izgledati kao da treba dodatno potvrditi preuzimanje.

**Prijedlog:** potvrditi „Dodano u inventar”, „Dodano u vrt” ili „Suncokreti su dodani na račun”, prema stvarnom rezultatu. Ponuditi odgovarajući idući korak: „Pogledaj u inventaru”, „Pronađi u vrtu” ili „Povratak na kalendar”. Ako dan ima više nagrada, pokazati sažetak svih nagrada uz „1 od 2” tijekom otkrivanja.

**Kriterij prihvata:** zatvaranje prikaza ne gubi nagradu; povratak u otvoreni dan pokazuje iste nagrade. Odredište se prikazuje samo kad postoji. Korisnik bez vrta dobiva jasno objašnjenje i održiv način spremanja nagrade prema pravilima nove kampanje.

**P1 · srednji opseg.**

### 8. Povezati zbirku poklona s drvcom koje već raste

**Problem:** ukrašavanje drvca postoji u vrtu, ali ga kalendar i prikaz nagrada slabo objašnjavaju; pregled nagrada razdvojen je po pojedinim danima.

**Prijedlog:** dodati „Moji adventski pokloni”, zbirku otvorenih nagrada i pregled drvca uz „8 otvorenih polja · 8 koraka ukrašavanja”. Nakon dodjele pokazati mali prije/poslije prikaz i poveznicu na drvce u vrtu. Ne otkrivati sadržaj budućih poklona.

**Kriterij prihvata:** zbirka i drvce koriste isti potvrđeni napredak računa. Prikaz u modalu može koristiti postojeće slike drvca, uz lagani 2D pregled; ne treba učitavati dodatnu WebGL scenu. Ako drvca nema, prikaz objašnjava stanje bez lažne potvrde postavljanja.

**P2 · srednji opseg.**

### 9. Dovršiti otvaranje pouzdano i kad veza zakaže

**Problem:** učitavanje i otvaranje nemaju potpun korisnički prikaz pogreške. Hookovi ne provjeravaju HTTP uspjeh prije čitanja JSON-a, a modal neuspjeh uglavnom zapisuje u konzolu. Klijentski datum može se razlikovati od datuma koji kampanja priznaje.

**Prijedlog:** tijekom zahtjeva označiti odabrano polje s „Otvaram…”; ostaviti pregled ostalih dana dostupnim. Razlikovati istek dana, zatvorenu kampanju, već otvoreno polje, istek prijave i mrežnu pogrešku. Nakon neizvjesnog odgovora prvo osvježiti povijest: ako je nagrada već dodijeljena, prikazati je; inače ponuditi „Pokušaj ponovno”.

**Kriterij prihvata:** prekid mreže nakon dodjele, dvostruki klik i istodobno otvaranje na dva uređaja završavaju jednim zapisom i jednom dodjelom. Provjeriti zaključavanje i brojanje dana isključivo unutar iste kampanje prije ponovne uporabe povijesne mutacije. UI koristi poslužiteljski status dostupnosti i ne prikazuje uspjeh na odgovoru 4xx/5xx.

**P0 · srednji do veliki opseg.**

### 10. Učiniti kalendar ugodnim na mobitelu i dostupnim svima

**Problem:** visoka mreža s pet stupaca smještena je u uski modal; oznake gumba danas uglavnom sadrže samo broj. Animacije uključuju njihanje, pulsiranje i konfete.

**Prijedlog:** na mobitelu koristiti četiri stupca ili prikaz po tjednima, zadržati veliko današnje polje u mreži i stabilan raspored. Ciljati dodirna područja najmanje 44 × 44 CSS px, čitljiv tekst, vidljiv fokus i dostupne nazive poput „12. prosinca, dostupno danas”. Stanje izražavaju oblik i simbol, a dostupni naziv prenosi puni tekst; uklonjene vizualne statusne oznake nisu uvjet za pristupačnost. Poštovati `prefers-reduced-motion`, uz statičnu potvrdu nagrade; animacije kratko prate uspjeh.

**Kriterij prihvata:** pregled i otvaranje rade na 320 px širine, uz tipkovnicu, uvećanje i smanjeno kretanje. Nema vodoravnog prelijevanja niti zaklanjanja današnjeg polja dekoracijom. Današnji dan i rezultat otvaranja dostupni su čitaču zaslona.

**P1 · srednji opseg.** Cilj od 44 px je dizajnerska preporuka za ovaj kalendar; WCAG 2.2 AA za [minimalnu veličinu cilja](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) navodi 24 px uz iznimke. Smjernica za [smanjeno kretanje](https://www.w3.org/WAI/WCAG22/Techniques/css/C39) daje konkretan CSS obrazac.

## Početna 3 prijedloga boljeg dizajna

Povijesna usporedba: [prvotna tri koncepta](../output/design-mocks/advent-calendar-2026/index-v1.html). Aktualni [interaktivni pregled](../output/design-mocks/advent-calendar-2026/index.html) razvija samo odabrani Zimski vrt; ostali smjerovi i izbornik smjerova uklonjeni su prema korisnikovoj odluci. Detaljna razrada: [dizajnerski smjerovi](../output/design-mocks/advent-calendar-2026/design-directions.md).

| Smjer | Izgled i iskustvo | Prednost | Kompromis |
| --- | --- | --- | --- |
| **1. Vrtna škrinjica — najmanji zahvat** | Topla krem podloga, papirnati prozorčići, postojeći artwork i blagdanska crvena/zelena uz zlatne akcente. Brojevi su poredani kronološki, a današnje polje dobiva svoj izravan gumb i jasan status. | Najbliže postojećem kalendaru; najveći dio modalnog toka i komponenti može se zadržati. | Manje naglašava vrt kao prostor od drugog smjera. |
| **2. Zimski vrt — odabrani smjer** | Zimska scena i postojeće adventsko drvce kao središnji motiv; raznovrsna vratašca sa snijegom na gornjim rubovima, zlatno današnje polje i dnevna/noćna paleta. | Najviše povezuje svakodnevni poklon s promjenom koju korisnik vidi u svom vrtu i prati dnevni ciklus igre. | Traži više rada na kompoziciji i prilagodbi mobitelu; koristiti slike/2D pregled radi troška učitavanja. |
| **3. Adventski herbarij** | Svijetli papir, botanička paleta, postojeća maskota i kronološki raspored s četiri stupca na mobitelu; nagrade kao mali zapisi u zbirci. | Najmirniji i najpregledniji smjer; dobro podržava povijest i čitanje na mobitelu. | Ima slabiji osjećaj traženja skrivenog prozorčića; eventualne botaničke tekstove urediti prije objave. |

Sva tri povijesna smjera prikazuju isti demonstracijski dan i napredak radi usporedbe. Nagrade, datum nove kampanje i eventualni uvjeti fizičkog poklona u konceptima nisu objavljena ponuda. Dizajnersku razradu pripremio je GPT‑6 Astra s razinom razmišljanja xhigh.

Za odabrani Zimski vrt paleta treba slijediti `useGameState.timeOfDay` i postojeće `getVisualDaylightAmount` / `getVisualNightAmount`. Igra već mapira stvarni izlazak sunca na 0,2 i zalazak na 0,8 te podržava zamrznuti datum i isključen dnevni ciklus. Kalendar treba čitati taj izvor vremena; izgled dana/noći ne određuje dostupnost nagrade. Samostalni prototip koristi označen simulirani sat za pregled, a stvarno povezivanje s igrom slijedi pri implementaciji.

### Zimski vrt — druga iteracija, sačuvana za usporedbu

[Sačuvani interaktivni V2](../output/design-mocks/advent-calendar-2026/index-v2.html).

- Šest stilova vratašaca: različiti gornji rubovi, prozorčići, vrpce, ručkice, uzorci i boje. Brojevi zadržavaju stabilan položaj i kronološki red.
- Polje 24 ima poseban oblik poklona s poklopcem i mašnom, također prekriven snijegom.
- Snijeg leži iznad svakog polja, s nepravilnim nanosima, prevjesima i malim sjenama. Ne zaklanja broj, status ili fokus.
- **Dan u V2:** svijetla snježna scena, pastelne kućice i zeleno današnje dugme. **Noć u V2:** duboka plava scena, topli prozori otvorenih polja, lampion i lampice bora. Dodatni gumb kasnije je uklonjen prema korisnikovoj odluci.
- Kontrole **Dan / Noć / Automatski** omogućuju usporedbu. Automatski pregled koristi simulirano vrijeme vrta na skali 0–1 i iste krivulje svitanja/sumraka kao igra.

Pri implementaciji automatski izgled čita postojeći `timeOfDay` iz igre, uključujući zamrznuti pregled i vrijednost 0,5 kada je dnevni ciklus isključen. Ne dodaje zaseban sat niti se veže uz tamnu temu operacijskog sustava. Dostupnost poklona određuje poslužitelj kampanje, ne vizualni način.

Prikazi druge iteracije: [usporedba dana i noći](../output/design-mocks/advent-calendar-2026/winter-v2-comparison.png), [dan na desktopu](../output/design-mocks/advent-calendar-2026/winter-v2-day-desktop.png), [noć na desktopu](../output/design-mocks/advent-calendar-2026/winter-v2-night-desktop.png), [dan na mobitelu](../output/design-mocks/advent-calendar-2026/winter-v2-day-mobile.png) i [noć na mobitelu](../output/design-mocks/advent-calendar-2026/winter-v2-night-mobile.png). [Detalji iteracije i povezivanja s igrom](../output/design-mocks/advent-calendar-2026/winter-v2-notes.md).

### Zimski vrt — treća iteracija, sačuvana za usporedbu

Svih osam korisnikovih komentara primijenjeno je u [sačuvanom interaktivnom V3](../output/design-mocks/advent-calendar-2026/index-v3.html):

1. Čitljiv tekst i statusi tijekom cijelog svitanja i sumraka; boje teksta i pozadine ne smiju se stopiti u prijelaznim tonovima.
2. Mjesec ima proziran izrez; svijetli samo osvijetljeni srp, bez nacrtanog tamnog diska.
3. Noćna scena dobiva zvijezde u pozadini koje prate noćni intenzitet.
4. Zakrivljena polja imaju veće gornje radijuse i snijeg koji prati cijeli luk; ravna polja dobivaju ravnije snježne kape. Kvadratni kutovi ne smiju viriti ispod zakrivljenog snijega.
5. Broj 24 stoji na zlatnoj ulaznici s valovitim rubovima, uz postojeći poklon s mašnom.
6. Brojač otvorenih dana, traka napretka i legenda uklanjaju se iz kalendara. Stanja ostaju na pojedinim poljima.
7. Dodatni gumb za otvaranje uklanja se. Poklon se otvara preko samog polja u mreži.
8. Aktualni pregled sadrži samo Zimski vrt, bez ostalih smjerova i izbornika smjerova. Povijesni V1 i V2 sačuvani su za usporedbu.

Kontrole za dnevni/noćni/automatski ugođaj, širinu i ogledna stanja služe pregledu prototipa i nalaze se izvan samog kalendara. Izgled i dalje slijedi simulaciju postojećih krivulja igre, a stvarno povezivanje s `timeOfDay` pripada budućoj implementaciji.

Prikazi treće iteracije: [dan, sumrak i noć usporedno](../output/design-mocks/advent-calendar-2026/winter-v3-comparison.png), [sumrak na desktopu](../output/design-mocks/advent-calendar-2026/winter-v3-dusk-desktop.png), [noć na mobitelu](../output/design-mocks/advent-calendar-2026/winter-v3-night-mobile.png) i [prikaz na korisnikovoj širini 691 px](../output/design-mocks/advent-calendar-2026/winter-v3-day-691px.png). [Detalji V3](../output/design-mocks/advent-calendar-2026/winter-v3-notes.md) opisuju geometriju, kontrast i povezivanje s igrom.

Otvaranje i ponovni pokušaj dostupni su samo na kartici. Nakon ogledne pogreške poruka upućuje na 12. polje, a njegov status postaje „Ponovi”. Nema dodatnog gumba koji preskače mrežu.

### Zimski vrt — četvrta iteracija, sačuvana za usporedbu

Sva četiri zahtjeva primijenjena su u [sačuvanom interaktivnom V4](../output/design-mocks/advent-calendar-2026/index-v4.html). Četvrti pregled pojednostavljuje mrežu i precizira dekoraciju:

1. Uklonjena su oba naslova iznad mreže: raspon „Prosinac · 1 — 24” i oznaka „Danas · N. dan”. Današnje polje i dalje nosi vlastiti status.
2. Pozadina cijele scene sadrži 62 zvijezde, u sloju iza drvca, poklona, mjeseca i teksta. Njih 21 nježno treperi različitim ritmovima od 11,61 do 17,94 sekunde; smanjeno kretanje zadržava statične zvijezde. Uske neprozirne podloge štite tekst i na najsvjetlijoj fazi treperenja, a ostatak lijeve strane ostaje zvjezdano nebo.
3. Zakrivljeni rub kartice i pripadajući snijeg koriste istu SVG krivulju, koordinatni sustav i transformaciju. Rub tijela prati zajedničku krivulju, a snijeg je potez po toj istoj krivulji. Tako se zajedno skaliraju pri svakoj širini, bez različitih dubina luka.
4. Statusni simbol, broj, tekst statusa i prozorčić imaju zajedničku vodoravnu os. V3 pomak od 2,5 px nastajao je jer je mobilna ikona bila uža, a zadržala je fiksni pomak za desktop. V4 koristi centriranje prema stvarnoj širini ikone; najveće izmjereno odstupanje je 0,0078 px.

Ostaju postojeći dogovori: jedan odabrani smjer, zlatna ulaznica 24. dana, proziran mjesečev srp, otvaranje i ponovni pokušaj kroz mrežu te dnevni/noćni izgled po vremenu igre.

Prikazi V4: [noć na korisnikovoj širini 712 px](../output/design-mocks/advent-calendar-2026/winter-v4-night-712px.png), [dan na 712 px](../output/design-mocks/advent-calendar-2026/winter-v4-day-712px.png), [sumrak](../output/design-mocks/advent-calendar-2026/winter-v4-dusk-desktop.png) i [svitanje](../output/design-mocks/advent-calendar-2026/winter-v4-dawn-desktop.png). [Bilješke V4](../output/design-mocks/advent-calendar-2026/winter-v4-notes.md) opisuju izvedbu i provjere.

### Zimski vrt — odluke iz petog pregleda

Sva četiri zahtjeva primjenjuje [arhivirani V5](../output/design-mocks/advent-calendar-2026/index-v5.html). Peti pregled precizira nebo, snijeg i fizički znak otvaranja:

1. Koristi se isti noćni starfield kao www: svih 36 izvornih točaka iz [PublicSkyBackdrop](../packages/ui/src/PublicChrome/PublicSkyBackdrop.tsx), njihovi radijusi, boje i neprozirnost te SVG uzorak 1280 × 896 u izvornom mjerilu. Kratka scena prikazuje izrez tog rijetkog neba, bez nove raspodjele po pravilnoj mreži.
2. Zajednička kontura lučnih polja dobila je sedam nepravilnih snježnih nakupina i četiri kapljice, uključujući vidljive srednje vrhove ispod grebena. Temeljni luk ostaje usklađen s tijelom kartice. Kapljice i njihova sjena ostaju najmanje 2,73 px udaljene od statusne ikone u provjerenim rasporedima.
3. Narančaste crtice i točke uklonjene su. One su u ranijim iteracijama predstavljale ukrasne ručke vratašaca, bez interaktivne funkcije.
4. Otvorena polja nemaju snijega i imaju razdvojene, poderane polovice papirnate oznake dana. Ponavljane vidljive oznake „Otvoreno”, „Uskoro” i „Propušteno” uklonjene su; puni nazivi stanja ostaju u dostupnim nazivima gumba. Današnji dan zadržava jasan zlatni tretman i oznaku „Danas”, a „Ponovi” ostaje dostupan pri pogrešci. Nakon uspješnog otvaranja isti fizički tretman vrijedi i za današnje polje.

Prototip prenosi izvorne definicije zvijezda u samostalni HTML. Pri implementaciji treba ponovno koristiti zajednički izvor iz `@gredice/ui`, bez paralelne nove distribucije. Noćni sloj koristi intenzitet `night × 0,82`; šest zvijezda može vrlo sporo treperiti, uz statičnu verziju pri smanjenom kretanju. Izvorno SVG mjerilo namjerno daje rijetko nebo u kratkoj sceni.

Prikazi V5: [usporedba dana, sumraka i noći](../output/design-mocks/advent-calendar-2026/winter-v5-comparison.png), [uvećana sva stanja](../output/design-mocks/advent-calendar-2026/winter-v5-states.png), [otvoreno polje](../output/design-mocks/advent-calendar-2026/winter-v5-night-opened-closeup.png), [buduće lučno polje](../output/design-mocks/advent-calendar-2026/winter-v5-night-future-closeup.png), [propušteno polje](../output/design-mocks/advent-calendar-2026/winter-v5-night-missed-closeup.png) i [današnje polje](../output/design-mocks/advent-calendar-2026/winter-v5-night-today-closeup.png). [Bilješke V5](../output/design-mocks/advent-calendar-2026/winter-v5-notes.md) pojašnjavaju izvor zvijezda, fizička stanja i metodologiju provjere.

### Zimski vrt — finiji snijeg nakon šestog pregleda

Aktualni [interaktivni V6](../output/design-mocks/advent-calendar-2026/index.html) smanjuje nakupine na lučnim poljima. Snijeg prati istu konturu kartice, uz sitnije neravne rubove i kraće, uže kapljice. Cilj je tanji prirodan sloj snijega, bez velikih odvojenih kuglastih oblika. Otvorena polja i dalje su bez snijega i s poderanom oznakom dana.

[Uvećani detalj](../output/design-mocks/advent-calendar-2026/winter-v6-night-future-closeup.png), [usporedba V5 i V6 u danu i noći](../output/design-mocks/advent-calendar-2026/winter-v6-comparison.png) i [bilješke V6](../output/design-mocks/advent-calendar-2026/winter-v6-notes.md) služe pregledu ove dekorativne izmjene. V5 je sačuvan za usporedbu.

## GitHub izvedba i testiranje datuma

[Epic #5222](https://github.com/gredice/gredice/issues/5222) prati deset prijedloga, [izvedbu redizajna #5233](https://github.com/gredice/gredice/issues/5233) i [feature flagove te simulaciju datuma #5234](https://github.com/gredice/gredice/issues/5234). [Plan implementacije](./advent-calendar-implementation-plan-2026.md) povezuje svaku stavku s podzadatkom i redoslijedom.

Za izvedbu redizajna traže se dva nova, početno isključena flaga: `enableAdventCalendarRedesign` i `enableAdventCalendarDateSimulation`. Uz postojeći `enableDebugHud` drugi flag omogućuje odabir datuma, prosinačke prečace i povratak na stvarno vrijeme kroz Debug HUD. Postojeći `SeasonDateControl`, `freezeTime` i `useLiveTime` služe kao polazište; Adventov HUD i modal trenutačno ne koriste taj isti sat.

Simulacija mora uskladiti današnje polje, stanje kampanje i HUD te označiti ogledni način. Otvaranja u tom načinu koriste izolirane testne nagrade i podatke, bez poziva stvarne dodjele. Datum simulacije ne mijenja poslužiteljsko pravo na stvarnu nagradu. Gašenje flaga i povratak na stvarno vrijeme brišu simulirani napredak i predmemoriju. Posebno se provjeravaju datumi prije adventa, 1./12./24. prosinca i nakon adventa, ponoć u `Europe/Zagreb`, promjena godine te dnevno i noćno svjetlo.

Demo PR sadrži ovaj dokument, samostalni V6 i povezane dokaze pregleda. Produkcijski flagovi i kontrole datuma pripadaju navedenim implementacijskim podzadacima; demo i dalje koristi fiksni ogledni datum.

## Preporučeni redoslijed

1. **Prije sezone:** #1 i #9 — odvojena nova kampanja, točno vrijeme i pouzdana dodjela.
2. **Prva verzija redizajna:** odabrani Zimski vrt uz #2, #3, #4, #7 i #10 — jasniji svakodnevni tok, potvrda nagrade i dnevni/noćni izgled.
3. **Nakon osnovnog toka:** #6 i #8 — podsjetnici i zbirka; #5 tek nakon definiranja pravila nove kampanje.

Prije/poslije usporedbu pratiti kroz broj dolazaka koji završe otvaranjem današnjeg polja, vrijeme do otvaranja, povratak sljedećeg dana te udio neuspješnih otvaranja. Trenutne vrijednosti nisu mjerene; ciljeve odrediti tek nakon početnog mjerenja. Provjera izvedbe treba uključiti zajednički račun, bez vrta, ponoć i završetak sezone, višestruke nagrade te oporavak nakon prekida zahtjeva.

## Izvori iz postojećeg repozitorija

- [Modal i tok ekrana](../packages/game/src/modals/advent/AdventModal.tsx)
- [Raspored kalendara](../packages/game/src/modals/advent/AdventCalendarScreen.tsx) i [polje](../packages/game/src/modals/advent/AdventDayCell.tsx)
- [Prikaz nagrade](../packages/game/src/modals/advent/AdventAwardScreen.tsx), [uvod](../packages/game/src/modals/advent/AdventDescriptionScreen.tsx) i [propušteni dan](../packages/game/src/modals/advent/AdventMissedDayScreen.tsx)
- [HUD](../packages/game/src/hud/AdventHud.tsx) i [razdoblje 2025.](../packages/game/src/hud/adventCalendarPeriod.ts)
- [Učitavanje](../packages/game/src/hooks/useAdventCalendar.ts) i [otvaranje](../packages/game/src/hooks/useOpenAdventDay.ts)
- [Drvce i napredak](../packages/game/src/entities/PineAdvent.tsx)
- [Izvor vremena igre](../packages/game/src/useGameState.ts), [mapiranje izlaska i zalaska sunca](../packages/game/src/utils/timeOfDay.ts) i [vizualni prijelazi dana/noći](../packages/game/src/scene/visualDayNight.ts)
- [Izvorni starfield javnog www prikaza](../packages/ui/src/PublicChrome/PublicSkyBackdrop.tsx)
- [Povijesna kampanja i nagrade](../apps/api/lib/occasions/advent2025.ts), [API rute](../apps/api/app/api/[...route]/occasionsRoutes.ts) i [pohrana otvaranja](../packages/storage/src/repositories/occasionsRepo.ts)

## Provjera isporuke

Izvorni kod aplikacije nije mijenjan. Dokument i HTML koncepti služe odabiru buduće izvedbe. Uredan status radne sesije i stanje zadatka izvještavaju se zasebno u završnoj poruci.

Izvorna usporedba tri smjera provjerena je Playwrightom: po 24 dana, mobilne širine 320 i 390 px, tablet 768 px i desktop; otvoreno, propušteno i buduće polje, čekanje, pogreška, ponovni pokušaj, potvrda nagrade, tipkovnička promjena smjera i smanjeno kretanje. Sačuvani su [rezultati prve verzije](../output/design-mocks/advent-calendar-2026/verification-v1.json).

Druga iteracija Zimskog vrta provjerena je zasebno u dnevnom i noćnom prikazu na 320, 390, 768 i 1440 px. Svaki prikaz ima 24 kronološka polja, 24 snježne kape, šest stilova vratašaca i poseban 24. poklon. Najmanja širina polja je 53,25 px, visina 88 px. Provjereni su otvoreno/propušteno/buduće polje, čekanje, pogreška i ponovni pokušaj, potvrda nagrade, povrat fokusa, tipkovnička promjena smjera i smanjeno kretanje. Automatski način provjeren je na devet vrijednosti vremena, uključujući svitanje, sumrak i dnevnu vrijednost 0,5.

Nisu zabilježene pogreške JavaScripta, odrezani statusi ni vodoravno prelijevanje u provjerenim prikazima. [Rezultati druge verzije](../output/design-mocks/advent-calendar-2026/verification-v2.json) odnose se na sačuvani V2.

V3 provjeren je u oba ugođaja na 320, 390, 691, 768 i 1440 px: svih 24 kronoloških polja, snježne kape, najmanje polje 53,25 × 88 px i zlatna ulaznica 24. dana. Otvoreno, propušteno, buduće, čekanje, pogreška, ponovni pokušaj kroz karticu, nagrada i povrat fokusa prošli su provjere. Uklonjeni elementi nisu prisutni; nema odrezanih statusa, vodoravnog prelijevanja ni pogrešaka JavaScripta.

Kontrast je izmjeren na 80 elemenata zaglavlja, scene, mreže, brojeva, statusa i simbola kroz 1001 vrijednost vremena. Najniži omjer je **4,5829:1**. Dodatna raster provjera na 26 kombinacija širine 390/1440 px i vremena, uključujući svitanje 0,22, sumrak 0,84 i mjesta izmjerenih minimuma, potvrđuje isti minimum na stvarnim podlogama ispod slova. Svaki uzorak pokriva svih 80 elemenata. Metoda isključuje razlike rubova koje ne odgovaraju miješanju boje slova i podloge; ne predstavlja potpunu WCAG reviziju. [Rezultati V3](../output/design-mocks/advent-calendar-2026/verification-v3.json) bilježe nula neuspjelih provjera.

V4 provjeren je u dnevnom i noćnom prikazu na **320, 390, 691, 712, 768 i 1440 px**. Svih 24 polja zadržava kronološki red, stanja i dodirnu veličinu. Zajedničke osi svih oznaka i sedam lučnih polja provjerene su na svih 12 kombinacija širine i ugođaja; uzorkovana geometrijska razlika rubova snijega i tijela iznosi nula. Pozadinski sloj zvijezda pokriva cijelu scenu. Promjena neprozirnosti izmjerena je na svih 21 animiranih zvijezda; pri smanjenom kretanju nijedna ne animira. Sačuvanih osam ugrađenih resursa potpuno je jednako V3.

V4 kontrast ponovno je provjeren na **78 elemenata kroz 1001 vrijednost vremena**; dva uklonjena naslova više nisu ciljevi mjerenja. Minimum ostaje **4,5829:1**. Raster provjera na 26 prikaza uključuje namjerno jači zvjezdani kadar: sve 62 zvijezde i njihov roditeljski sloj postavljeni su na punu neprozirnost tijekom mjerenja, preko normalnog vrhunca treperenja. Time su provjerene stvarne podloge ispod svih slova. Otvaranje i retry kroz karticu, nagrada, fokus i tipkovnica ostaju ispravni. [Završni rezultati V4](../output/design-mocks/advent-calendar-2026/verification-v4.json) bilježe nula neuspjelih provjera i nula pogrešaka JavaScripta. Provjere vrijede za lokalni prototip i navedeni opseg.

V5 ponovno provjerava svih šest širina u oba ugođaja. Izvorne 36 definicije zvijezda i SVG uzorak 1280 × 896 odgovaraju www izvoru u svih 12 prikaza, bez rastezanja. Početnih devet otvorenih polja ima devet poderanih oznaka i nula snježnih kapa; preostalih 15 polja zadržava snijeg. Nakon otvaranja 12. polja njegov snijeg nestaje i broj dobiva dva poderana dijela, uz ponovno otvaranje nagrade i povrat fokusa. Nema ukrasnih ručkica ni ponavljanih statusnih natpisa; dostupni nazivi svih 24 gumba zadržavaju puni status. Danas/Ponovi ostaju jedine namjerne oznake akcije u mreži.

V5 mjerenje kontrasta ima **64 cilja kroz 1001 vrijednost vremena**. Uključuje svaku od 18 pojedinačnih znamenki na stvarnoj neprozirnoj polovici papira otvorenih dana, umjesto prozirnog omotača oznake. Minimum tih papirnatih podloga je **7,683:1**, a ukupni minimum **4,5829:1**. Raster provjera na 26 prikaza koristi granice tekstnog raspona svake zakrenute znamenke i najjači zvjezdani sloj. [Rezultati V5](../output/design-mocks/advent-calendar-2026/verification-v5.json) opisuju opseg, sva stanja i reduced motion; ovo ostaje ciljana lokalna provjera, bez tvrdnje o potpunoj reviziji pristupačnosti.

V6 ima [ciljanu provjeru dekorativne izmjene](../output/design-mocks/advent-calendar-2026/verification-v6.json) na **390, 712 i 1440 px**, u danu i noći. Snježni greben i tijelo koriste isti path i transformaciju; manje nakupine i kraće kapljice sa sjenom ostaju najmanje **7,49 px** udaljene od ikone. Svih 24 polja ostaje vidljivo, otvorena su bez snijega, a vodoravnog preljeva nema. CSS, zvijezde, interakcije i osam ugrađenih resursa identični su V5. Nema neuspjelih provjera ni pogrešaka JavaScripta. Raniji puni kontrastni i interakcijski rezultati ostaju jasno označeni dokaz V5; nisu ponovno mjereni u ovoj dekorativnoj iteraciji.

Produkcijski API, cjelovita pristupačnost i čitač zaslona, stvarno povezivanje sa satom igre te fizički uređaji zahtijevaju provjeru pri implementaciji.
