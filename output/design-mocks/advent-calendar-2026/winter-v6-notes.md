# Zimski vrt — iteracija 06

4. listopada 2026. · [Otvori V6](./index.html) · [Usporedba V5 / V6](./winter-v6-comparison.png) · [Sačuvani V5](./index-v5.html)

Ova iteracija mijenja **samo oblik nakupina i kapljica snijega na neotvorenim lučnim poljima**. Cilj je prirodniji, nizak sloj snijega koji prati kućicu, bez velikih odvojenih grudica.

Nakupine su pliće i manje, s nepravilnim razmacima. Polumjeri su smanjeni s najviše 9,5 × 5,8 na 6,2 × 3,2 SVG jedinice. Četiri kapljice ostaju vidljive, ali su uže, kraće i sužavaju se prema kraju: dubina je sada 6,1–7,8 umjesto 9,5–13, a poluširina 1,8–2,7 umjesto 3,5–5,2. Ispod osnovnog grebena vire samo 2,1–3,8 jedinica.

Osnovni snježni greben, zajednički SVG path s tijelom kućice i njegova transformacija ostaju isti. Otvorena polja i dalje imaju poderane oznake i nemaju snijeg. Izvorno www zvjezdano polje, sve slike/fontovi, boje, raspored i ponašanje nisu mijenjani.

## Ciljana provjera V6

[verification-v6.json](./verification-v6.json) i aktualni [verification.json](./verification.json) jasno označavaju ovu provjeru kao **ciljanu dekorativnu provjeru**, odvojenu od ranije pune provjere V5.

- Vizualno su pregledani korisnikov izrez, uvećano 15. polje, mobilnih 390 px, prikaz 712 px s poljem širine približno 125 px te desktop od 1440 px, u danu i noći.
- U svih šest prikaza provjeren je zajednički gornji path i transformacija tijela/snježnog grebena te razmak kapljica i njihove sjene od ikone; najmanji izmjereni razmak je **7,49 px**.
- Svih 24 polja ostaje u mreži; 9 otvorenih ima poderane oznake i nijedan snježni element, a ostalih 15 snijeg. Nema vodoravnog preljeva.
- CSS, zvjezdani SVG, ponašanje i svi ostali dijelovi HTML-a identični su V5 nakon izuzimanja samo `curvedSnow()` i vidljivih oznaka verzije. Svih 8 data URI-ja identično je V5, uz SHA-256 dokaz u [v6-asset-integrity.json](./v6-asset-integrity.json).
- Ciljana provjera završila je s `failures=[]` i `pageErrors=[]`.

Puni kontrastni sweep, raster i sve interakcije **nisu ponovno izvođeni** jer ova izmjena mijenja samo dekorativne snježne oblike iznad zaštićenih oznaka. [verification-v5.json](./verification-v5.json) ostaje neizmijenjeni prethodni dokaz: minimum 4,583 : 1 ukupno i 7,683 : 1 za poderane znamenke, šest širina u oba ugođaja te otvaranje, retry kroz polje i povrat fokusa. V6 zapis sadrži referencu i jasno označene naslijeđene rezultate; ne predstavlja ih kao novo mjerenje.

## Datoteke

- `index.html`, `design-directions.md`: aktualni V6; `index-v5.html` i `design-directions-v5.md` čuvaju V5.
- `winter-v6-comparison.html/png`: isti dan 15 u V5 i V6, danju i noću.
- `winter-v6-{day,night}-future-closeup.png`: uvećani novi snijeg.
- `winter-v6-{day,night}-future-{390,712,1440}px.png`: izrezi u stvarnoj veličini na ciljanim širinama.
- `winter-v6-{day,night}-{390px,712px,desktop}.png`: cijeli kalendar.

Ovo ostaje koncept za pregled. Nema promjena produkcijskog koda, aktivacije kampanje, PR-a ili mergea.
