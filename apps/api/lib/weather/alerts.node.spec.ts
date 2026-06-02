import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    filterWeatherAlertsForFarm,
    parseDhmzCapAlertXml,
    resolveWeatherAlertRegionCode,
} from './alerts';

const sampleCapXml = `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>2.49.0.0.191.0.HR.test.LDZM</identifier>
  <sender>https://meteo.hr</sender>
  <sent>2026-06-02T17:46:47+02:00</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <language>hr</language>
    <category>Met</category>
    <event>Žuto upozorenje za grmljavinsku oluju</event>
    <urgency>Future</urgency>
    <severity>Moderate</severity>
    <certainty>Likely</certainty>
    <onset>2026-06-03T12:00:00+02:00</onset>
    <expires>2026-06-03T20:00:00+02:00</expires>
    <senderName>DHMZ Državni hidrometeorološki zavod</senderName>
    <description>Lokalno mogući izraženiji pljuskovi s grmljavinom.</description>
    <instruction>Budite na oprezu na otvorenim terenima.</instruction>
    <parameter>
      <valueName>awareness_level</valueName>
      <value>2; yellow; Moderate</value>
    </parameter>
    <parameter>
      <valueName>awareness_type</valueName>
      <value>3; Thunderstorm</value>
    </parameter>
    <area>
      <areaDesc>Zagrebačka regija</areaDesc>
      <geocode>
        <valueName>EMMA_ID</valueName>
        <value>HR002</value>
      </geocode>
    </area>
  </info>
  <info>
    <language>en</language>
    <category>Met</category>
    <event>Yellow thunderstorm warning</event>
    <urgency>Future</urgency>
    <severity>Moderate</severity>
    <certainty>Likely</certainty>
    <onset>2026-06-03T12:00:00+02:00</onset>
    <expires>2026-06-03T20:00:00+02:00</expires>
    <senderName>DHMZ Državni hidrometeorološki zavod</senderName>
    <description>Locally possible severe thundershowers.</description>
    <parameter>
      <valueName>awareness_level</valueName>
      <value>2; yellow; Moderate</value>
    </parameter>
    <parameter>
      <valueName>awareness_type</valueName>
      <value>3; Thunderstorm</value>
    </parameter>
    <area>
      <areaDesc>Zagreb region</areaDesc>
      <geocode>
        <valueName>EMMA_ID</valueName>
        <value>HR002</value>
      </geocode>
    </area>
  </info>
</alert>`;

const bjelovarFarm = {
    latitude: 45.9,
    longitude: 16.84,
};

describe('parseDhmzCapAlertXml', () => {
    it('normalizes CAP warning fields', async () => {
        const alerts = await parseDhmzCapAlertXml(
            sampleCapXml,
            'https://example.com/cap.xml',
        );

        assert.equal(alerts.length, 2);
        const croatianAlert = alerts.find((alert) => alert.language === 'hr');
        assert.ok(croatianAlert);
        assert.equal(
            croatianAlert.event,
            'Žuto upozorenje za grmljavinsku oluju',
        );
        assert.equal(croatianAlert.area.regionCode, 'HR002');
        assert.equal(croatianAlert.awarenessLevel?.color, 'yellow');
        assert.equal(croatianAlert.awarenessType?.id, '3');
        assert.equal(
            croatianAlert.description,
            'Lokalno mogući izraženiji pljuskovi s grmljavinom.',
        );
    });
});

describe('filterWeatherAlertsForFarm', () => {
    it('uses the nearest land warning region and preferred language', async () => {
        const alerts = await parseDhmzCapAlertXml(sampleCapXml);
        const filtered = filterWeatherAlertsForFarm(alerts, bjelovarFarm, {
            now: new Date('2026-06-03T08:00:00+02:00'),
        });

        assert.equal(resolveWeatherAlertRegionCode(bjelovarFarm), 'HR002');
        assert.equal(filtered.length, 1);
        assert.equal(filtered[0]?.language, 'hr');
    });

    it('falls back to another source language when preferred text is missing', async () => {
        const alerts = (await parseDhmzCapAlertXml(sampleCapXml)).filter(
            (alert) => alert.language === 'en',
        );
        const filtered = filterWeatherAlertsForFarm(alerts, bjelovarFarm, {
            now: new Date('2026-06-03T08:00:00+02:00'),
        });

        assert.equal(filtered.length, 1);
        assert.equal(filtered[0]?.language, 'en');
    });
});
