import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseBjelovarForecastXml } from './forecast';

const currentFeedXml = `<?xml version="1.0" encoding="utf-8"?>
<sedamdana>
  <izmjena run="06">Zadnja izmjena 05.07.2026. u 13:48.</izmjena>
  <grad ime="ZAGREB" code="ZAGREB">
    <dan datum="05.07.2026." dtj="Nedjelja" sat="09" leadtime="1">
      <t_2m>21.2</t_2m>
      <simbol>2</simbol>
      <vjetar>C0</vjetar>
      <oborina>0.0</oborina>
    </dan>
  </grad>
  <grad ime="BJELOVAR" code="BJELOVAR">
    <dan datum="05.07.2026." dtj="Nedjelja" sat="09" leadtime="1">
      <t_2m>22.6</t_2m>
      <simbol>3</simbol>
      <vjetar>C0</vjetar>
      <oborina>0.0</oborina>
    </dan>
    <dan datum="05.07.2026." dtj="Nedjelja" sat="15" leadtime="7">
      <t_2m>28.7</t_2m>
      <simbol>15</simbol>
      <vjetar>NW1</vjetar>
      <oborina>0.2</oborina>
    </dan>
    <dan datum="06.07.2026." dtj="Ponedjeljak" sat="08" leadtime="24">
      <t_2m>24.0</t_2m>
      <simbol>2n</simbol>
      <vjetar>W2</vjetar>
      <oborina>1.4</oborina>
    </dan>
  </grad>
</sedamdana>`;

const legacyFeedXml = `<?xml version="1.0" encoding="UTF-8"?>
<sedmodnevna_aliec>
  <izmjena run="06">Zadnja izmjena 05.07.2026. u 14:51.</izmjena>
  <grad ime="Bjelovar" lokacija="Bjelovar" code="14253">
    <dan datum="05.07.2026." dtj="Nedjelja" sat="11">
      <t_2m>28</t_2m>
      <simbol>1</simbol>
      <vjetar>NE1</vjetar>
      <oborina>0.0</oborina>
    </dan>
    <dan datum="06.07.2026." dtj="Ponedjeljak" sat="2">
      <t_2m>22</t_2m>
      <simbol>2n</simbol>
      <vjetar>C0</vjetar>
      <oborina>0.0</oborina>
    </dan>
  </grad>
</sedmodnevna_aliec>`;

const staleFeedXml = `<?xml version="1.0" encoding="UTF-8"?>
<sedmodnevna_aliec>
  <izmjena run="06">Zadnja izmjena 25.06.2026. u 14:51.</izmjena>
  <grad ime="Bjelovar" lokacija="Bjelovar" code="14253">
    <dan datum="01.07.2026." dtj="Srijeda" sat="20">
      <t_2m>27</t_2m>
      <simbol>1</simbol>
      <vjetar>SE1</vjetar>
      <oborina>0.0</oborina>
    </dan>
  </grad>
</sedmodnevna_aliec>`;

describe('parseBjelovarForecastXml', () => {
    it('parses the current DHMZ meteogram feed shape', async () => {
        const forecast = await parseBjelovarForecastXml(
            currentFeedXml,
            new Date('2026-07-05T15:03:00+02:00'),
        );

        assert.equal(forecast.length, 2);
        assert.equal(forecast[0]?.date, '2026-07-05');
        assert.equal(forecast[0]?.minTemp, 22.6);
        assert.equal(forecast[0]?.maxTemp, 28.7);
        assert.equal(forecast[0]?.rain, 0.2);
        assert.equal(forecast[0]?.entries[0]?.windDirection, null);
        assert.equal(forecast[0]?.entries[1]?.windDirection, 'NW');
        assert.equal(forecast[1]?.entries[0]?.symbol, 2);
        assert.equal(forecast[1]?.entries[0]?.windStrength, 2);
    });

    it('keeps compatibility with the legacy DHMZ feed shape', async () => {
        const forecast = await parseBjelovarForecastXml(
            legacyFeedXml,
            new Date('2026-07-05T15:03:00+02:00'),
        );

        assert.equal(forecast.length, 2);
        assert.equal(forecast[0]?.date, '2026-07-05');
        assert.equal(forecast[0]?.entries[0]?.temperature, 28);
        assert.equal(forecast[0]?.entries[0]?.windDirection, 'NE');
        assert.equal(forecast[1]?.entries[0]?.windDirection, null);
    });

    it('rejects stale feeds before cron can write fake current history', async () => {
        await assert.rejects(
            () =>
                parseBjelovarForecastXml(
                    staleFeedXml,
                    new Date('2026-07-05T15:03:00+02:00'),
                ),
            /stale/,
        );
    });
});
