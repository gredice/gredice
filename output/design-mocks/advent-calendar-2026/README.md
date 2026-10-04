# Adventski kalendar — Zimski vrt V6

Samostalni interaktivni demo odabranog redizajna za [Uredan zadatak](../../../docs/advent-calendar-improvements-2026.md) `2828593d-1403-45a6-b9bb-0ce555906f2b`. Aktualni izvor je [index.html](./index.html); arhive V1–V5 čuvaju tijek pregleda.

## Pokretanje

Iz korijena repozitorija:

```sh
python3 -m http.server 55849 --bind 127.0.0.1 --directory output/design-mocks/advent-calendar-2026
```

Otvoriti [lokalni pregled](http://127.0.0.1:55849/index.html). Za izdvojenu kopiju mape ista naredba može se pokrenuti u toj mapi bez argumenta `--directory`. Nisu potrebni Node, pnpm, build ni mrežni resursi: slike i rukopisni font ugrađeni su u HTML.

## Što demo prikazuje

- 24 kronološka polja; današnje polje otvara oglednu nagradu. Otvorena polja imaju poderane oznake broja i nemaju snijeg.
- Dan / Noć / Automatski, ogledni klizač vremena osvjetljenja, desktop/mobilnu širinu i birač stanja za pregled čekanja, pogreške i nagrade.
- Ponovni pokušaj preko 12. polja, pregled ranije otvorene nagrade, tipkovnicu, Escape i smanjeno kretanje. „Vrati ogledne podatke” vraća početno stanje.

**Datum je fiksni ogledni 12. prosinca 2026.; 50 suncokreta je izmišljeni primjer. Demo ne poziva API, ne mijenja račun i ne dodjeljuje stvarne nagrade.** Klizač mijenja samo osvjetljenje, ne datum kalendara. Povezivanje s igrom, novim feature flagovima i simuliranim datumom kroz Debug HUD pripada budućoj implementaciji.

## Pregled i dokazi

- [Dizajnerske smjernice](./design-directions.md) i [V6 bilješke](./winter-v6-notes.md).
- Aktualni V6: [dan na desktopu](./winter-v6-day-desktop.png), [noć na desktopu](./winter-v6-night-desktop.png), [noć na 390 px](./winter-v6-night-390px.png) i [usporedba snijega V5–V6](./winter-v6-comparison.html).
- [Ciljana provjera V6](./verification-v6.json) obuhvaća dekorativni snijeg. [Puna prethodna provjera V5](./verification-v5.json) sadrži kontrast, rasporede i interakcije; nije ponovno izvođena u V6.
- [Manifest za objavu](./publication-manifest.json) navodi samo lokalno povezane Advent datoteke. Nepovezane snimke ostaju lokalno.

Za PR su najkorisnije aktualna noćna mobilna i dnevna desktop snimka te usporedba snijega. Ovaj paket prikazuje demo; ne aktivira kampanju i ne implementira produkcijski redizajn.
