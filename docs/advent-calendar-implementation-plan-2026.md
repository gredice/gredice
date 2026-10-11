# Plan izvedbe adventskog kalendara

Epic: [#5222](https://github.com/gredice/gredice/issues/5222) · Uredan `2828593d-1403-45a6-b9bb-0ce555906f2b`

Plan prati [prijedloge i odabrani V6](./advent-calendar-improvements-2026.md). Demo se pregledava kroz PR; produkcijska implementacija ostaje otvorena u podzadacima.

| Prijedlog | Podzadatak | Prioritet | Preduvjeti |
| --- | --- | --- | --- |
| 1 | [#5223 — [Advent] Support annual campaigns and preserve historical calendars](https://github.com/gredice/gredice/issues/5223) | P0 | — |
| 2 | [#5224 — [Advent] Make today and daily availability clear in the calendar](https://github.com/gredice/gredice/issues/5224) | P1 | #5223, #5231, #5233 |
| 3 | [#5225 — [Advent] Shorten onboarding and keep campaign rules available](https://github.com/gredice/gredice/issues/5225) | P1 | #5223 |
| 4 | [#5226 — [Advent] Explain final reward eligibility from campaign rules](https://github.com/gredice/gredice/issues/5226) | P1 | #5223 |
| 5 | [#5227 — [Advent] Define and implement one missed-day recovery for a future campaign](https://github.com/gredice/gredice/issues/5227) | P2 — campaign-rule decision required | #5223, #5226, #5231 |
| 6 | [#5228 — [Advent] Add opt-in reminders with time and channel preferences](https://github.com/gredice/gredice/issues/5228) | P2 | #5223, #5224 |
| 7 | [#5229 — [Advent] Show where rewards were added and useful next actions](https://github.com/gredice/gredice/issues/5229) | P1 | #5223, #5231 |
| 8 | [#5230 — [Advent] Connect gift history with existing PineAdvent decoration progress](https://github.com/gredice/gredice/issues/5230) | P2 | #5223, #5229 |
| 9 | [#5231 — [Advent] Make reward opening idempotent and recover from uncertain responses](https://github.com/gredice/gredice/issues/5231) | P0 | #5223 |
| 10 | [#5232 — [Advent] Verify responsive layout, keyboard access and reduced motion](https://github.com/gredice/gredice/issues/5232) | P1 | #5233, #5224, #5225, #5229 |
| Redizajn | [#5233 — [Advent] Implement Zimski vrt calendar redesign from the reviewed V6 demo](https://github.com/gredice/gredice/issues/5233) | P1 | #5234 |
| Testiranje datuma | [#5234 — [Advent] Add feature flags and Debug HUD date simulation for redesign testing](https://github.com/gredice/gredice/issues/5234) | P1 — testing foundation | — |

## Feature flagovi i Debug HUD

`enableAdventCalendarRedesign` odvaja novi izgled od postojećeg kalendara. `enableAdventCalendarDateSimulation`, zajedno s postojećim `enableDebugHud`, omogućuje izbor Advent datuma i povratak na stvarno vrijeme. Oba nova flaga početno su isključena.

Postojeći `apps/garden/app/flags.ts`, `getGardenGameFlags`, `GameFlagsContext`, `SeasonDateControl`, `freezeTime` i `useLiveTime` polazište su izvedbe. Nova kontrola treba pokriti datume prije adventa, 1./12./24. prosinca i nakon adventa, granice godine te ponoć u zoni kampanje. Datum kampanje i ugođaj dan/noć provjeravaju se zajedno.

Simulirani HUD, današnje polje, dostupnost i otvaranja koriste iste izolirane testne podatke. Nema stvarnih dodjela, promjene računa ni miješanja testne i stvarne predmemorije. Isključivanje simulacije vraća stvarno stanje; poslužitelj i dalje odlučuje o stvarnoj dostupnosti i dodjeli.

## Redoslijed

P0 temelji kampanje i pouzdanog otvaranja prethode aktivaciji stvarnih nagrada. Izolirana simulacija prethodi provjeri redizajna. Dnevni tok, uvod i prikaz nagrade koriste te temelje; provjera pristupačnosti obuhvaća završni integrirani kalendar. P2 podsjetnici, zbirka i nadoknada propuštenog dana imaju vlastite preduvjete.

Nadoknada propuštenog dana zahtijeva odluku o pravilima prije implementacije. Ovaj plan ne mijenja povijesne uvjete za 2025. Objavljivanje demo PR-a ne zatvara implementacijske podzadatke.
