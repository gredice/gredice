import { parseStringPromise } from "xml2js";

interface WeatherEntry {
    time: number;
    temperature: number;
    symbol: number;
    windDirection: string | null;
    windStrength: number;
    rain: number;
}

interface DayForecast {
    date: string;
    minTemp: number;
    maxTemp: number;
    symbol: number;
    windDirection: string | null;
    windStrength: number;
    rain: number;
    entries: WeatherEntry[];
}

interface CityData {
    $: {
        ime: string;
    };
    dan: Array<{
        $: {
            datum: string;
            sat: string;
        };
        t_2m: string[];
        simbol: string[];
        vjetar: string[];
        oborina: string[];
    }>;
}

interface ParsedXmlData {
    sedmodnevna_aliec: {
        grad: CityData[];
    };
}

export async function getBjelovarForecast(): Promise<DayForecast[]> {
    try {
        console.log('Fetching data from URL...');
        const response = await fetch('https://prognoza.hr/sedam/hrvatska/7d_meteogrami.xml');
        console.log('Fetch completed. Status:', response.status);

        const xml = await response.text();
        console.log('XML data received. Length:', xml.length);

        console.log('Parsing XML data...');
        const data: ParsedXmlData = await parseStringPromise(xml);
        console.log('XML parsing completed.');

        const bjelovarForecast = data.sedmodnevna_aliec.grad.find(city => city.$.ime === 'Bjelovar');
        if (!bjelovarForecast) {
            console.log('Bjelovar forecast not found.');
            throw new Error('Bjelovar forecast not found.');
        }

        const fiveDayForecast: DayForecast[] = [];
        let currentDay: DayForecast | null = null;

        for (const entry of bjelovarForecast.dan) {
            const date = entry.$.datum.replace(/(\d+)\.(\d+)\.(\d+)\./, '$3-$2-$1');
            const time = parseInt(entry.$.sat, 10);
            const temperature = parseInt(entry.t_2m[0], 10);
            const symbol = parseInt(entry.simbol[0].replace('n', ''), 10);
            const windRaw = entry.vjetar[0];

            let windDirection: string | null = null;
            let windStrength = 0;
            if (windRaw !== 'C') {
                const match = windRaw.match(/([A-Z]+)(\d+)/);
                if (match) {
                    windDirection = match[1];
                    windStrength = Math.min(parseInt(match[2], 10), 3);
                }
            }

            const rain = parseFloat(entry.oborina[0]);

            if (currentDay === null || currentDay.date !== date) {
                if (fiveDayForecast.length >= 6) break;

                currentDay = {
                    date,
                    minTemp: temperature,
                    maxTemp: temperature,
                    windDirection: windDirection,
                    windStrength: windStrength,
                    entries: [],
                    symbol,
                    rain
                };
                fiveDayForecast.push(currentDay);
            }

            currentDay.minTemp = Math.min(currentDay.minTemp, temperature);
            currentDay.maxTemp = Math.max(currentDay.maxTemp, temperature);

            if (windStrength > currentDay.windStrength) {
                currentDay.windDirection = windDirection;
                currentDay.windStrength = windStrength;
            }
            currentDay.entries.push({ time, temperature, symbol, windDirection, windStrength, rain });
        }

        // Sort the forecasts by date
        fiveDayForecast.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return fiveDayForecast;
    } catch (error) {
        console.error('Error fetching or parsing weather data:', error);
        throw error;
    }
}
