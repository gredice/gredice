# Zimski vrt — iteracija 03

4. listopada 2026. · Uredan `2828593d-1403-45a6-b9bb-0ce555906f2b`

[Otvori V3](./index.html) · [Usporedi dan, sumrak i noć](./winter-v3-comparison.png) · [Sačuvani V2](./index-v2.html)

Ova iteracija primjenjuje svih osam komentara iz preglednika na odabrani Zimski vrt. Produkcijski kod i kampanja ostaju izvan ove dizajnerske isporuke.

## Osam primijenjenih izmjena

1. **Kontrast kroz prijelaze.** Ambijent i toplina svjetla i dalje se postupno miješaju po krivuljama igre. Boja teksta više se ne interpolira zajedno s pozadinom: bira se tamnozelena, bijela ili crna prema kontrastu stvarne izračunate podloge. Statusi i oznake stanja imaju čvrste kontrastne podloge. Područja iza naslova, opisa, zaglavlja i naziva mreže sada imaju neprozirnu kontroliranu podlogu; zvijezde, teren i dekorativni gradijenti izdvojeni su iz područja teksta. To je provjereno i na sumraku `0.84` i svitanju `0.22`.
2. **Proziran mjesečev srp.** SVG maska uklanja zasjenjeni dio mjeseca. Kroz izrez se vidi stvarno nebo, bez tamnog diska naslikanog iznad scene.
3. **Vidljive noćne zvijezde.** Mirno polje od 46 zvijezda i tri diskretna zvjezdasta akcenta pojavljuje se prema postojećem `night` iznosu. Nema treperenja ili nove animacije. Polje je izdvojeno od teksta.
4. **Veći lukovi i pripadajući snijeg.** Zaobljena polja imaju pravi eliptični gornji rub: visina luka 34 px na desktopu, 25 px na mobilnom rasporedu. Njihove snježne kape prate luk do oba bočna ruba. Ravna i blago zaobljena vratašca imaju plosnatije kape. Male oznake stanja pomaknute su na sigurno mjesto iznad broja, izvan snijega; fokus obuhvaća cijelo polje i snježni rub.
5. **Posebna zlatna karta za 24. dan.** Broj 24 leži na zasićenoj zlatnoj karti s valovitim/scalloped rubovima i tankim unutarnjim okvirom. Zadržani su zaseban poklopac poklona, vrpca, mašna i snijeg.
6. **Uklonjen donji pregled.** Nema broja „N od 24”, trake napretka ili legende na dnu kalendara. Status je vidljiv na svakom polju.
7. **Otvaranje samo kroz polje.** Uklonjena je glavna radnja „Otvori 12. dan” i sav alternativni tok prvog otvaranja iz zaglavlja. Opis vodi pogled prema 12. polju. Nakon pogreške poruka ostaje vidljiva, polje dobiva oznaku „Ponovi”, a ponovni pokušaj pokreće klik ili Enter na tom polju. U poruci pogreške nema zasebnog gumba za otvaranje.
8. **Jedan odabrani koncept.** Uklonjeni su izbor smjera, Vrtna škrinjica i Adventski herbarij, uključujući njihov HTML i JavaScript u aktualnom prototipu. Ostaje samo Zimski vrt, uz vanjske kontrole pregleda širine, stanja i osvjetljenja. Poveznica na V2 omogućuje povijesnu usporedbu.

## Dan, noć i vrijeme igre

Ugovor iz [V2 bilježaka](./winter-v2-notes.md) ostaje isti. Produkcijsko povezivanje treba koristiti [useGameState](../../../packages/game/src/useGameState.ts), postojeći `timeOfDay` i funkcije iz [scene/visualDayNight.ts](../../../packages/game/src/scene/visualDayNight.ts):

```text
daylight(t) = min(smoothstep(0.16, 0.28, t),
                  1 - smoothstep(0.80, 0.88, t))
night(t)    = max(1 - smoothstep(0.14, 0.24, t),
                  smoothstep(0.82, 0.88, t))
```

`utils/timeOfDay.ts` mapira stvarni astronomski izlazak na normalizirani `0.2`, a zalazak na `0.8`. Isključen ciklus koristi `ALWAYS_DAY_TIME = 0.5`. Ovdje se prikazuje **simulirano normalizirano vrijeme**; nije uveden novi zidni sat niti je HTML povezan s aktivnim vrtom. Datum kampanje i dostupnost dana ostaju odvojeni od svjetla.

Ručni Dan koristi `0.5`, Noć `0.98`; Automatski slijedi ogledni klizač. Bor je postojeći statični artwork, uz dekorativno svjetlo. Produkcija treba koristiti postojeću vezu `PineAdvent` s napretkom i postojeće vremenske helper funkcije, bez dupliciranja modela vremena.

## Kvantitativna provjera kontrasta

Provjera je usmjerena na tekst aktualnog kalendara, a nije puni WCAG audit cijele aplikacije, fotografija/artworka, čitača zaslona ili fizičkih uređaja.

**Sweep 0–1:** 1001 normalizirano vrijeme, korak `0.001`, 80 elemenata u svakom koraku — ukupno 80.080 parova. U svakom je koraku preglednik stvarno izračunao CSS boje; čitani su foreground i neprozirna podloga ispod tog elementa, ne nominalna boja cijelog panela. Mjereni su zaglavlje i njegove radnje, tekst scene, nazivi mreže, 24 prozorčića s brojevima, 24 statusa i 24 oznake stanja.

| Područje | Najniži kontrast u cijelom sweepu |
| --- | ---: |
| Zaglavlje i njegove radnje | 4,635 : 1 |
| Naslov, opis i doba dana u sceni | 4,645 : 1 |
| Nazivi iznad mreže | 4,587 : 1 |
| Brojevi dana | **4,583 : 1** |
| Statusi dana | 6,437 : 1 |
| Male oznake stanja | 6,437 : 1 |

Sva mjerena područja prelaze cilj **4,5 : 1**, uključujući veliki naslov za koji je traženo barem 3 : 1. Najniža vrijednost pojavljuje se na budućem broju 13 pri normaliziranom vremenu `0.207`.

**Provjera stvarnih renderiranih piksela:** dodatno je provjereno 26 prikaza: širine 390 i 1440 px × vremena `0`, `0.16`, `0.20`, `0.207`, `0.209`, `0.22`, `0.229`, `0.24`, `0.5`, `0.82`, `0.84`, `0.86`, `0.88`. Time su obuhvaćeni konkretni komentirani prijelazi i vremena najnižih vrijednosti iz sweepa.

Za svaki prikaz snimljen je obični render i identični render s prozirnim tekstom. Mjeren je originalni foreground naspram stvarnog RGB-a neposredno ispod vidljivih glifova. Time se uključuju kompozicija pozadine, obrubi, snijeg, ornamentacija i zlatna SVG maska gdje bi bili ispod teksta. Svih 80 ciljeva mora imati detektirane vidljive glifove; izostanak glifa znači neuspješnu provjeru. Svih 26 prikaza ima **80/80 pokrivenih ciljeva**, a najniži izmjereni kontrast pod stvarnim glifom također je **4,583 : 1**.

Klasifikacija piksela zahtijeva razliku barem 8 u jednom RGB kanalu te fizički moguće miješanje boje glifa s podlogom (`alpha 0.025–1.02`, najveći RGB ostatak 4). Male razlike rasterizacije ruba koje se ne mogu dobiti iz boje glifa bilježe se kao razlike izvan teksta i ne predstavljaju uzorak glifa. Ovo je spriječilo pogrešno tumačenje jednog rubnog piksela značke kao teksta, bez izuzimanja bilo kojeg tekstnog cilja. Pozadina i tekst nisu promijenjeni radi zaobilaženja mjerenja.

Detaljni podaci, minimumi, koordinate i opseg mjerenja nalaze se u [verification-v3.json](./verification-v3.json).

## Raspored i interakcije

Provjerene su širine **320, 390, 691, 768 i 1440 px** u dnevnom i noćnom prikazu. Svih 24 dana ostaje u kronološkom redu. Nema vodoravnog preljeva ili odrezanih statusa. Najmanje polje je **53,25 × 88 px**, iznad cilja 44 × 44 px.

Prošli su otvoreni/propušteni/budući dani, čekanje, pogreška, ponovni pokušaj isključivo preko polja 12, nagrada, ažuriranje stanja i povrat fokusa nakon Escape. Sekvencijski Tab dovodi fokus s 11. na 12. polje; Enter pokreće otvaranje. `prefers-reduced-motion` uklanja prijelaze i pokrete. Zvijezde su statične i označene kao dekoracija. Vidljivi naziv statusa prenosi značenje i bez boje.

Vanjski birač stanja služi pregledu prototipa; primjer nagrade u njemu nije stvarna dodjela. Nagrada i dalje potvrđuje da je dodana te vraća na kalendar, bez privida drugog preuzimanja.

## Datoteke

- `index.html`: aktualni samostalni V3, bez vanjskih resursa.
- `index-v2.html`, `design-directions-v2.md`, `verification-v2.json`: sačuvani V2; V1 datoteke također ostaju.
- `winter-v3-day-desktop.png`, `winter-v3-night-desktop.png`, `winter-v3-dusk-desktop.png`, `winter-v3-dawn-desktop.png`.
- `winter-v3-day-mobile.png`, `winter-v3-night-mobile.png`, `winter-v3-dusk-mobile.png`, `winter-v3-dawn-mobile.png`.
- `winter-v3-comparison.png`: zajednički pregled Dana / Sumraka 0,84 / Noći.
- `winter-v3-*-320px.png`, `winter-v3-*-691px.png`: ciljane širine dnevnog/noćnog prikaza.
- `winter-v3-*-error.png`, `winter-v3-*-reward.png`, `winter-v3-focus.png`: ključna stanja i vidljiv fokus.
- `verification-v3.json` i aktualni `verification.json`: završna provjera; `failures=[]`, `pageErrors=[]`.

Datum 12. prosinca 2026. i nagrade ostaju jasno označeni ogledni podaci. Ovo je rezultat za korisnikov pregled; nije produkcijska implementacija, aktivacija kampanje, PR ili merge.
