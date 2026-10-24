# Zimski vrt — iteracija 04

4. listopada 2026. · Uredan `2828593d-1403-45a6-b9bb-0ce555906f2b`

[Otvori V4](./index.html) · [Dan / sumrak / noć](./winter-v4-comparison.png) · [Sačuvani V3](./index-v3.html)

Odabrani Zimski vrt sada primjenjuje četiri dodatna komentara iz korisnikova pregleda. Ovo je interaktivni koncept za pregled; produkcijski kod i aktivacija kampanje nisu dio ove isporuke.

## Četiri izmjene

1. **Mreža bez dodatnih naslova.** Uklonjeni su „PROSINAC · 1 — 24” i „DANAS · N. DAN”. Svih 24 polja ostaje kronološki poredano. Nagrada i ponovni pokušaj otvaraju se isključivo odabirom današnjeg polja.
2. **Zvijezde preko cijelog neba.** Polje od 62 zvijezde pokriva cijelu širinu i visinu scene, uključujući lijevu stranu; 23 zvijezde nalaze se u lijevoj trećini. Zvijezde su iza mjeseca, bora, poklona, lanterne i teksta. Samo 21 zvijezda polako mijenja neprozirnost, s različitim trajanjem od 11,61 do 17,94 sekunde, početnim pomacima i nepravilno razmaknutim vrhuncima. Ne mijenjaju položaj ili veličinu. Smanjeno kretanje isključuje animaciju i prikazuje stabilnu neprozirnost. Cijelo polje i dalje blijedi prema noćnoj krivulji igre. Tekst ima lokalnu neprozirnu podlogu; ostatak lijeve polovice ostaje otvoren zvijezdama.
3. **Jedan oblik za lučnu kućicu i snijeg.** Sedam lučnih polja koristi SVG tijelo umjesto neovisnog CSS zaobljenja. Isti gornji path započinje tijelo kućice i kroz `<use>` crta snježni greben. Tijelo i snijeg dijele isti SVG, `viewBox`, transformaciju i skaliranje na svakoj širini. Snježni potez ima okrugle krajeve, a male snježne nakupine slijede točke toga luka. Zato nema izloženih četvrtastih kutova ispod jače zaobljene kape. Ravna polja zadržavaju ravne kape, a 24. dan zaseban poklopac, mašnu i zlatnu kartu.
4. **Zajednička središnja os.** Ikona stanja sada koristi `left: 50%` i `translateX(-50%)`, uz `right: auto`. Time se uklanja raniji pomak od 2,5 px nastao kad se mobilna ikona smanjila s 16 na 11 px, a pozicija je i dalje oduzimala 8 px. Ikona, broj, tekst statusa i prozor sada dijele vodoravnu os.

## Mjerenja i provjera

[verification-v4.json](./verification-v4.json) sadrži završni zapis; [verification.json](./verification.json) je njegova jednaka aktualna kopija.

| Provjera | Rezultat |
| --- | --- |
| Širine u oba ugođaja | 320, 390, 691, 712, 768 i 1440 px; 12 prikaza |
| Kronološka mreža | 24 polja u svakom prikazu; bez preljeva ili odrezanih statusa |
| Najmanja dodirna meta | 53,25 × 88 px |
| Najveći odmak zajedničkih osi | **0,0078125 px**, ispod cilja 0,5 px, za 24 polja × 12 prikaza |
| Zajednički luk | 7 polja × 12 prikaza; identičan path prefiks, isti SVG i transform; **0 px** odstupanja u 21 uzorkovanoj točki svakog luka |
| Zvjezdani sloj | Točno poklapanje pravokutnika sa scenom; `z-index: 0`, mjesec 1, artwork 2, svjetla 3, tekst 4 |
| Animacija | 21/62 zvijezde; svih 21 mijenja neprozirnost; svih 21 ima `animation: none` uz reduced motion |
| Ugrađeni resursi | Svih 8 data URI-ja identično V3; provjereni SHA-256 otisci |
| Greške | `pageErrors=[]`, `failures=[]` |

Geometrijska provjera čita stvarne DOM granice ikone, broja, statusa i prozora; nije procjena optičkog centra nacrtanog znaka. Za luk uspoređuje path tijela s dijeljenim gornjim pathom, SVG transformacije i 21 točku transformiranu u isti koordinatni sustav. Sjena snijega namjerno je pomaknuta prema dolje i nije rub tijela.

**Kontrast kroz sva vremena:** 1001 korak od 0 do 1 po 0,001 × 78 tekstnih ciljeva, ukupno 78.078 parova. Preglednik računa stvarne foreground i neprozirne podloge zaglavlja, lokalnog teksta scene, 24 broja, 24 statusa i 24 ikone. Najniži kontrast je **4,583 : 1** za broj 13 pri vremenu 0,207. Zaglavlje ima najmanje 4,635 : 1, tekst scene 4,645 : 1, statusi i ikone 6,437 : 1.

**Raster i najjače zvijezde:** dodatnih 26 prikaza (390 i 1440 px × 13 vremena, uključujući svitanje 0,22 i sumrak 0,84) snimljeno je sa **svih 62 zvijezde i njihovim roditeljskim slojem na neprozirnosti 1**. To je strože od stvarnog intenziteta noći i vrhunca treperenja. Uspoređuje se običan render s istim renderom bez boje teksta, pa je podloga stvarni RGB neposredno ispod vidljivih glifova. Lokalna podloga teksta ostaje onakva kakva je u dizajnu.

Klasifikacija zahtijeva razliku barem 8 u RGB kanalu i moguće miješanje foregrounda preko pozadine (`alpha 0.025–1.02`, najveći ostatak po kanalu 4). Razlike koje ne mogu potjecati od tog glifa bilježe se zasebno. Svih 78 ciljeva ima prepoznate glifove u svakom od 26 prikaza; minimum je ponovno **4,583 : 1**. Ovo je ciljana provjera prototipa, a ne puni WCAG audit. Stil za maksimalni intenzitet zvijezda uklonjen je prije završnih screenshotova.

Ponovljeni su otvoreni, propušteni i budući dan, čekanje, pogreška, ponovni pokušaj Enterom na 12. polju, nagrada, novo otvoreno stanje, Escape i povrat fokusa. U poruci pogreške nema dodatnog gumba za otvaranje. Tab prelazi s 11. na 12. polje. Završne snimke ručno su pregledane, uključujući uske rasporede i oba prijelaza.

## Ugovor s igrom

Produkcijsko povezivanje ostaje preko [useGameState.timeOfDay](../../../packages/game/src/useGameState.ts) i postojećih helpera iz [visualDayNight.ts](../../../packages/game/src/scene/visualDayNight.ts):

```text
daylight(t) = min(smoothstep(0.16, 0.28, t), 1 - smoothstep(0.80, 0.88, t))
night(t)    = max(1 - smoothstep(0.14, 0.24, t), smoothstep(0.82, 0.88, t))
```

Prototip koristi označeno simulirano normalizirano vrijeme. Dan je 0,5, Noć 0,98, Automatski prati ogledni klizač. Produkcija treba poštovati postojeće lokacijsko/astronomsko vrijeme, datum i freeze postavke te isključeni ciklus koji daje 0,5. Dostupnost dana i dodjela nagrade ostaju odvojene od svjetla. Datum 12. prosinca 2026. i nagrade su ogledni podaci. Bor ostaje postojeći artwork; produkcija treba zadržati postojeću povezanost `PineAdvent` ukrasa s otvorenim danima.

## Datoteke

- `index.html`, `design-directions.md`: aktualni V4.
- `index-v3.html`, `design-directions-v3.md`, `verification-v3.json`: sačuvani V3; V1 i V2 također ostaju.
- `winter-v4-{day,night,dusk,dawn}-{desktop,mobile}.png`: četiri ugođaja u dva rasporeda.
- `winter-v4-{day,night}-{320,691,712}px.png`: ciljane širine.
- `winter-v4-{day,night}-{error,reward}.png`, `winter-v4-focus.png`: ključna stanja.
- `winter-v4-comparison.html` i `winter-v4-comparison.png`: zajednički pregled dana, sumraka i noći.
- `verification-v4.json`, `verification.json`, `v4-asset-integrity.json`: završni dokazi.
