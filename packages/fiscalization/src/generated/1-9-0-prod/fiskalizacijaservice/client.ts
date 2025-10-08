import {
    type IExOptions as ISoapExOptions,
    type Client as SoapClient,
    createClientAsync as soapCreateClientAsync,
} from 'soap';
import type { DohvatiRadnoVrijemeOdgovor } from './definitions/DohvatiRadnoVrijemeOdgovor';
import type { DohvatiRadnoVrijemeZahtjev } from './definitions/DohvatiRadnoVrijemeZahtjev';
import type { NapojnicaOdgovor } from './definitions/NapojnicaOdgovor';
import type { NapojnicaZahtjev } from './definitions/NapojnicaZahtjev';
import type { ObrisiRadnoVrijemeOdgovor } from './definitions/ObrisiRadnoVrijemeOdgovor';
import type { ObrisiRadnoVrijemeZahtjev } from './definitions/ObrisiRadnoVrijemeZahtjev';
import type { PrijaviRadnoVrijemeOdgovor } from './definitions/PrijaviRadnoVrijemeOdgovor';
import type { PrijaviRadnoVrijemeZahtjev } from './definitions/PrijaviRadnoVrijemeZahtjev';
import type { PromijeniNacPlacOdgovor } from './definitions/PromijeniNacPlacOdgovor';
import type { PromijeniNacPlacZahtjev } from './definitions/PromijeniNacPlacZahtjev';
import type { PromijeniPodatkeRacunaOdgovor } from './definitions/PromijeniPodatkeRacunaOdgovor';
import type { PromijeniPodatkeRacunaZahtjev } from './definitions/PromijeniPodatkeRacunaZahtjev';
import type { RacunOdgovor } from './definitions/RacunOdgovor';
import type { RacunZahtjev } from './definitions/RacunZahtjev';
import type { String } from './definitions/String';
import type { String1 } from './definitions/String1';
import type { FiskalizacijaService } from './services/FiskalizacijaService';

export interface FiskalizacijaServiceClient extends SoapClient {
    FiskalizacijaService: FiskalizacijaService;
    racuniAsync(
        racunZahtjev: RacunZahtjev,
        options?: ISoapExOptions,
    ): Promise<
        [
            result: RacunOdgovor,
            rawResponse: any,
            soapHeader: any,
            rawRequest: any,
        ]
    >;
    promijeniNacPlacAsync(
        promijeniNacPlacZahtjev: PromijeniNacPlacZahtjev,
        options?: ISoapExOptions,
    ): Promise<
        [
            result: PromijeniNacPlacOdgovor,
            rawResponse: any,
            soapHeader: any,
            rawRequest: any,
        ]
    >;
    napojnicaAsync(
        napojnicaZahtjev: NapojnicaZahtjev,
        options?: ISoapExOptions,
    ): Promise<
        [
            result: NapojnicaOdgovor,
            rawResponse: any,
            soapHeader: any,
            rawRequest: any,
        ]
    >;
    promijeniPodatkeRacunaAsync(
        promijeniPodatkeRacunaZahtjev: PromijeniPodatkeRacunaZahtjev,
        options?: ISoapExOptions,
    ): Promise<
        [
            result: PromijeniPodatkeRacunaOdgovor,
            rawResponse: any,
            soapHeader: any,
            rawRequest: any,
        ]
    >;
    prijaviRadnoVrijemeAsync(
        prijaviRadnoVrijemeZahtjev: PrijaviRadnoVrijemeZahtjev,
        options?: ISoapExOptions,
    ): Promise<
        [
            result: PrijaviRadnoVrijemeOdgovor,
            rawResponse: any,
            soapHeader: any,
            rawRequest: any,
        ]
    >;
    obrisiRadnoVrijemeAsync(
        obrisiRadnoVrijemeZahtjev: ObrisiRadnoVrijemeZahtjev,
        options?: ISoapExOptions,
    ): Promise<
        [
            result: ObrisiRadnoVrijemeOdgovor,
            rawResponse: any,
            soapHeader: any,
            rawRequest: any,
        ]
    >;
    dohvatiRadnoVrijemeAsync(
        dohvatiRadnoVrijemeZahtjev: DohvatiRadnoVrijemeZahtjev,
        options?: ISoapExOptions,
    ): Promise<
        [
            result: DohvatiRadnoVrijemeOdgovor,
            rawResponse: any,
            soapHeader: any,
            rawRequest: any,
        ]
    >;
    echoAsync(
        echoRequest: String,
        options?: ISoapExOptions,
    ): Promise<
        [result: String1, rawResponse: any, soapHeader: any, rawRequest: any]
    >;
}

/** Create FiskalizacijaServiceClient */
export function createClientAsync(
    ...args: Parameters<typeof soapCreateClientAsync>
): Promise<FiskalizacijaServiceClient> {
    return soapCreateClientAsync(args[0], args[1], args[2]) as any;
}
