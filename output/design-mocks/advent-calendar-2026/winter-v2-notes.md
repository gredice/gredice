# Zimski vrt — iteracija 02: snježna vratašca, dan i noć

4. listopada 2026. · Uredan `2828593d-1403-45a6-b9bb-0ce555906f2b`

Korisnik je odabrao **smjer 2 — Zimski vrt**. Ova iteracija razvija odabrani smjer: razigranija polja, snijeg na njihovim gornjim rubovima te dnevni i noćni ugođaj usklađen s postojećim vremenom igre.

[Interaktivni pregled](./index.html) otvara Zimski vrt kao zadani smjer. [Usporedba dana i noći](./winter-v2-comparison.png) pokazuje obje varijante. Prvotni smjerovi ostaju dostupni kroz kartice, a potpuna prethodna verzija čuva se u [index-v1.html](./index-v1.html) i [design-directions-v1.md](./design-directions-v1.md).

## Vizualne promjene

- **Šest usklađenih vrsta vratašaca:** bordo drvena vrata, zelena kutija s vrpcom, plava kućica zaobljenog vrha, medeno pakiranje s kosim prugama, ljubičasta kutija s uspravnim detaljima i petrolej kućica sa sitnim ukrasima. Razlikuju se gornji rubovi, prozorčići, ručke i dekoracije. Raspored i brojevi ostaju kronološki.
- **Snijeg leži na svakom polju:** šest nepravilnih SVG silueta s nakupinama, prevjesima i kratkim ledenim kapljicama; hladna sjena odvaja snijeg od kutije. Zaobljene kućice imaju snježni rub koji prati krov. Razmaci između redaka ostavljaju mjesto snijegu.
- **24. dan je poklon:** poseban poklopac, uspravna zlatna vrpca i mašna iznad snijega. Polje ostaje dio iste uredne mreže i ne sugerira drukčija pravila ili pravo na fizički poklon.
- **Dan:** svijetlo snježno tlo, blijedoplavo nebo, sunce, čitljivi pastelni i blagdanski tonovi te mekše sjene.
- **Noć:** plavopetrolej pozadina, mjesec, toplo osvijetljeni prozori otvorenih dana, jače svjetlo lampiona i svjetlosni akcenti bora.
- **Otvoreni dani zadržavaju raznolike boje:** dodana nagrada prepoznaje se po upaljenom prozoru, kvačici i oznaci „Otvoreno”. Budući prozori noću ostaju tamni. Propuštena polja imaju prigušene tonove, kosu teksturu, crticu i puni naziv statusa. Današnji dan ima zlatan obrub i izričitu oznaku „Danas”.

Na desktopu je mreža 6 × 4, na mobitelu 4 × 6. Povećani međuredni razmak namjerno daje mjesta snijegu i mašni. Sva 24 dana ostaju dostupna; mobilni prikaz može se pomicati okomito.

## Dan, noć i Automatski

Kontrole za pregled nalaze se izvan samog kalendara:

- **Dan** pokazuje stabilan dnevni uzorak (`timeOfDay = 0.5`).
- **Noć** pokazuje stabilan noćni uzorak (`timeOfDay = 0.98`).
- **Automatski** koristi klizač **Simulirano vrijeme vrta · skala 0–1**. To nije sat uređaja, trenutno stanje korisničkog vrta ni aktivna veza s igrom.

Ručni načini prikazuju „Ručni pregled · Dan/Noć” i onemogućuju klizač, pa se ne prikazuje proturječan aktivni sat. Automatski način blago miješa boje i intenzitet svjetla u svitanju i sumraku; nema zasebne neprestane animacije ili obaveznih čestica snijega.

**Ogledni datum 12. prosinca 2026. odvojen je od klizača osvjetljenja.** Pomicanje vremena vrta ne otvara dan, ne mijenja datum dostupnosti nagrade i ne mijenja stanje računa. Broj otvorenih dana i 50 suncokreta ostaju jasno označeni kao ogledni podaci.

## Ugovor za buduće povezivanje s igrom

Produkcijska izvedba treba čitati postojeći [useGameState](../../../packages/game/src/useGameState.ts), a ne uvoditi novi zidni sat, hardkodirane lokalne sate ili odabir prema sistemskoj dark temi. Stanje već sadrži `timeOfDay`, `sunriseTime`, `sunsetTime`, `timeLocation`, `dayNightCycleDisabled` i postojeće override/freeze ponašanje datuma scene.

[utils/timeOfDay.ts](../../../packages/game/src/utils/timeOfDay.ts) astronomski izlazak sunca mapira na normalizirani `0.2`, a zalazak na `0.8`; te vrijednosti nisu 04:48 i 19:12 lokalnog sata. Lokacija i datum već se obrađuju postojećom logikom. Zadana lokacija igre je 45.739 / 16.572. Isključen dnevno-noćni ciklus daje `ALWAYS_DAY_TIME = 0.5`, stoga kalendar ostaje u dnevnom prikazu i poštuje odluku korisnika.

Paletu i sjaj povezati s [scene/visualDayNight.ts](../../../packages/game/src/scene/visualDayNight.ts):

```ts
const daylight = getVisualDaylightAmount(timeOfDay);
const night = getVisualNightAmount(timeOfDay);
```

Prototip radi istu matematičku simulaciju:

```text
smoothstep(a, b, x):
  t = clamp((x - a) / (b - a), 0, 1)
  return t² × (3 - 2t)

daylight(t) = min(smoothstep(0.16, 0.28, t),
                  1 - smoothstep(0.80, 0.88, t))
night(t)    = max(1 - smoothstep(0.14, 0.24, t),
                  smoothstep(0.82, 0.88, t))
```

Boje se miješaju prema `daylight`; intenzitet osvijetljenih detalja prema `night`. To čuva razliku između prijelaza ambijenta i paljenja svjetala. Produkcija treba ponovno upotrijebiti te funkcije iz igre, bez njihovog dupliciranja. Primjere nagrada i podatke o kalendaru treba zamijeniti stvarnim stanjem kampanje; dostupnost dana uvijek određuje ugovor kampanje/API-ja.

[PineAdvent](../../../packages/game/src/entities/PineAdvent.tsx) već povezuje ukrase i svjetla s brojem otvorenih dana. Ta se veza zadržava. Ovdje je korišten postojeći statični artwork bora s dekorativnim svjetlosnim akcentima; to nije prikaz stvarnog broja ukrasa nekog korisnika. Implementaciju borove progresije i eventualni način prikaza u modalu treba uskladiti s postojećom komponentom.

## Stanja i pristupačnost

Sačuvani su detalji otvorenih/propuštenih/budućih dana, čekanje, trajna poruka pogreške, ponovni pokušaj, nagrada i ažuriran napredak. Nagrada izričito kaže da je već dodana; „Povratak na kalendar” ne simulira novu dodjelu. Noćni prikaz ima i usklađen dijalog nagrade.

Broj i status ostaju pravi tekst iznad dekoracije. Snijeg, vrpce i svjetla su `aria-hidden` i ne hvataju pointer događaje. Svako polje ima puni pristupačni naziv; današnje koristi `aria-current="date"`. Fokus je vidljiv, dijalozi se zatvaraju tipkom Escape i vraćaju fokus na odgovarajuće polje. Kartice smjerova podržavaju strelice/Home/End. `prefers-reduced-motion` uklanja pokrete i prijelaze, uz očuvan tekstualni status.

## Isporuka i provjera

- `index.html`: aktualni samostalni V2 pregled; svi resursi su ugrađeni.
- `index-v1.html`, `design-directions-v1.md`, `verification-v1.json`: prethodna verzija sačuvana.
- `winter-v2-day-desktop.png`, `winter-v2-night-desktop.png`: desktop kalendari.
- `winter-v2-day-mobile.png`, `winter-v2-night-mobile.png`: mobilni kalendari.
- `winter-v2-day-320px.png`, `winter-v2-night-320px.png`: najniža provjerena širina stranice.
- `winter-v2-day-error.png`, `winter-v2-night-error.png`, `winter-v2-day-reward.png`, `winter-v2-night-reward.png`: ključna povratna stanja.
- `winter-v2-comparison.png`: usporedba oba ugođaja.
- `verification-v2.json` i aktualni `verification.json`: rezultati provjera prototipa.

Provjera obuhvaća oba ručna ugođaja na 320/390/768/1440 px, 24 kronološka dana, šest stilova/snježnih silueta, poseban 24. dan, bez preljeva ili odrezanih statusa, mete dnevnih polja najmanje 44 × 44 px, sve interakcije, povrat fokusa, tipkovnicu i smanjeni pokret. Automatski način uspoređen je s očekivanim vrijednostima obje postojeće krivulje na devet normaliziranih vremena, uključujući svitanje i sumrak. Desktop i mobilne slike pregledane su vizualno.

Ova isporuka ostaje koncept za pregled. Produkcijski kod, kampanja i pravila nagrađivanja nisu mijenjani; nema PR-a, mergea ili objave.
