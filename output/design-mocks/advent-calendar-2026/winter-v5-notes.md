# Zimski vrt — iteracija 05

4. listopada 2026. · Uredan `2828593d-1403-45a6-b9bb-0ce555906f2b`

[Otvori V5](./index-v5.html) · [Dan / sumrak / noć](./winter-v5-comparison.png) · [Detalji četiriju stanja](./winter-v5-states.png) · [Sačuvani V4](./index-v4.html)

## Četiri primijenjene izmjene

1. **Izvorno zvjezdano polje javne stranice.** Preuzeto je svih 36 zapisa `publicEnvironmentStars` iz [PublicSkyBackdrop.tsx](../../../packages/ui/src/PublicChrome/PublicSkyBackdrop.tsx): iste koordinate, polumjeri, boje i `fillOpacity`. SVG pattern ostaje **1280 × 896, `userSpaceOnUse`**, bez `viewBox` skaliranja ili pomicanja uzorka. Sloj koristi izvorni `nightAmount × 0.82`, a prijelaz neprozirnosti traje 1,2 s kao u [utilities.css](../../../packages/ui/src/utilities.css). Kratka scena zato pokazuje mali, rijedak isječak istog neba; broj vidljivih zvijezda nije umjetno povećan. Šest izvornih zvijezda dodatno vrlo blago treperi različitim ritmovima od 13,7 do 18,9 s; njihov izvorni `fillOpacity` ostaje sačuvan. Reduced motion zaustavlja treperenje i prijelaz. Sloj pokriva cijelu scenu iza mjeseca, ilustracija i lokalno podloženog teksta.
2. **Nepravilniji snijeg na lučnim poljima.** Zadržan je zajednički path tijela i snježnog grebena. Sedam nakupina različitih veličina i četiri viseća snježna vrha prate točke istog luka, uz male razlike među poljima. Tri vrha leže jasno u srednjem dijelu luka (oko 26%, 50% i 72%), a četvrti bliže kraju. Dubine od 9,5 do 13 SVG jedinica vidljivo se spuštaju ispod osnovnog grebena; najmanji izmjereni razmak vrha sa sjenom od ikone iznosi 2,73 px. Greben, nakupine i vrhovi dijele jednu zajedničku sjenu pa djeluju kao snijeg u jednoj cjelini. Nema povratka izloženih četvrtastih kutova.
3. **Bez ručki.** Uklonjene su sve zlatne crtice/točkice ručki. Nisu potrebne za razumijevanje radnje.
4. **Stanje u samoj oznaci dana.** Otvorena polja imaju dvije odvojene, nazubljeno poderane i blago zakrenute papirnate polovice. Svaka nosi jednu čitljivu znamenku. Za otvorena polja snijeg se uopće ne renderira. Uklonjeni su ponavljani natpisi „Otvoreno”, „Uskoro” i „Propušteno”. Buduće polje ostaje cijelo i snježno; propušteno ima hladniji ton, šrafuru, isprekidani rub oznake i minus. Današnje je zlatno s jedinom oznakom **Danas**, odnosno **Ponovi** nakon pogreške. Puni nazivi stanja ostaju u `aria-label`. Nakon potvrđene ogledne nagrade 12. polje odmah postaje poderano i bez snijega; ponovno otvara pregled nagrade.

Na najužim prikazima papirnate su polovice proširene i znamenke prilagođene tako da poderani rub ne zahvati broj. Ikona i cijela oznaka broja dijele središnju os; polovice su namjerno razmaknute oko nje.

## Dokazi provjere

[verification-v5.json](./verification-v5.json) i jednaki aktualni [verification.json](./verification.json) bilježe:

- **12 rasporeda:** 320, 390, 691, 712, 768 i 1440 px, svaki u danu i noći; 24 kronološka polja, bez preljeva, mete najmanje 53,25 × 88 px.
- **Fizička stanja:** 9 otvorenih polja = 9 poderanih oznaka / 18 papirnatih polovica / 0 snježnih elemenata. Preostalih 15 polja ima snijeg. Samo današnje ima tekstni status; ručki nema.
- **Geometrija:** najviše 0,0078125 px odmaka između centra ikone, cijele oznake broja i preostalih oznaka. Sedam lučnih tijela ima identičan gornji path; četiri neotvorena lučna polja imaju isti path i transform snijega, uz 0 px razlike na 21 uzorkovanoj točki.
- **Izvorne zvijezde:** svih 36 zapisa jednako izvoru u svih 12 rasporeda; pattern ima izvorno mjerilo, SVG transform skale je 1, a polje točno prati scenu. Provjerene su i stvarne neprozirnosti u danu, svitanju, sumraku i noći.
- **Resursi:** svih 8 ugrađenih data URI-ja identično arhiviranom V4, uz SHA-256 otiske u [v5-asset-integrity.json](./v5-asset-integrity.json).
- **Interakcije:** otvoreno, propušteno, buduće, čekanje, pogreška, retry Enterom isključivo na 12. polju, nagrada, nova poderana oznaka bez snijega, Escape i povrat fokusa. Tab ide s 11. na 12. polje. Reduced motion zaustavlja svih šest zvjezdanih animacija.

**Kontrast:** 1001 vrijeme od 0 do 1 u koracima 0,001 × **64 cilja**, odnosno 64.064 para: zaglavlje 3, scena 3, cijeli brojevi 15, pojedinačne znamenke poderanog papira 18, današnji status 1 i ikone 24. Svaka poderana znamenka mjeri se naspram svoje stvarne neprozirne papirnate podloge, a ne prozirnog zajedničkog okvira. Najmanje vrijednosti: svi ciljevi **4,583 : 1**, poderane znamenke **7,683 : 1**, tekst scene 4,645 : 1, današnji status 8,865 : 1.

Dodatni raster obuhvaća 26 prikaza (390 i 1440 px × 13 vremena, uključujući 0,22 i 0,84). Sve zvijezde i njihov sloj prisilno su na neprozirnosti 1 uz zadržani izvorni `fillOpacity`, što je svjetlije od stvarnog prikaza. Običan render uspoređuje se s istim renderom bez boje teksta; mjeri se foreground naspram stvarnog RGB-a ispod vidljivog glifa. Za svaku poderanu znamenku koristi se granica njezina **tekstnog Rangea**, čime se izbjegava uključivanje susjedne kvačice u veliki rotirani pravokutnik papirnate polovice. Klasifikacija zadržava prag razlike 8, mogući alpha 0,025–1,02 i maksimalni RGB ostatak 4. Svih 26 prikaza ima 64/64 cilja s detektiranim glifovima. Najniži raster kontrast iznosi 4,583 : 1 ukupno i 7,683 : 1 za poderane znamenke. Ovo je ciljana provjera, ne puni WCAG audit aplikacije.

Završne snimke ručno su pregledane, uključujući 320 px i uvećane otvorene, propuštene, buduće i današnje oznake. Završni zapis ima `failures=[]` i `pageErrors=[]`.

## Povezivanje s igrom i datoteke

Samostalni HTML kopira izvorni SVG samo radi prijenosnog pregleda. Produkcijska izvedba treba dijeliti postojeći zvjezdani renderer/podatke, umjesto održavanja drugog popisa zvijezda. U ovoj iteraciji nisu mijenjani produkcijski komponenta ni CSS.

Osvjetljenje i dalje koristi označeno simulirano `timeOfDay` te točne helper krivulje igre iz [visualDayNight.ts](../../../packages/game/src/scene/visualDayNight.ts). Produkcija treba povezati [useGameState](../../../packages/game/src/useGameState.ts), postojeće lokacijsko/astronomsko vrijeme, freeze postavke i isključeni ciklus (0,5). Dostupnost dana i nagrade odvojene su od svjetla. Datum 12. prosinca 2026. i 50 suncokreta ostaju ogledni podaci.

- `index-v5.html` i `design-directions-v5.md`: sačuvani V5; V4 je sačuvan u `index-v4.html` i `design-directions-v4.md`, uz ranije V1–V3.
- `winter-v5-{day,night,dusk,dawn}-{desktop,mobile}.png`: četiri ugođaja u dva rasporeda.
- `winter-v5-{day,night}-{320,691,712}px.png`: ciljane širine.
- `winter-v5-{day,night}-{opened,missed,today,future}-closeup.png`: uvećana fizička stanja.
- `winter-v5-{day,night}-{error,reward,after-open}.png`, `winter-v5-focus.png`: interakcije.
- `winter-v5-comparison.html/png`, `winter-v5-states.html/png`: zajednički pregledi za raspravu; opisne oznake u tim prikazima nisu dio kalendara.

Isporuka ostaje koncept za korisnikov pregled, bez produkcijske implementacije, aktivacije kampanje, PR-a ili mergea.
