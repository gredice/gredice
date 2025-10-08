import type { DohvatiRadnoVrijemeOdgovor } from '../definitions/DohvatiRadnoVrijemeOdgovor';
import type { DohvatiRadnoVrijemeZahtjev } from '../definitions/DohvatiRadnoVrijemeZahtjev';
import type { NapojnicaOdgovor } from '../definitions/NapojnicaOdgovor';
import type { NapojnicaZahtjev } from '../definitions/NapojnicaZahtjev';
import type { ObrisiRadnoVrijemeOdgovor } from '../definitions/ObrisiRadnoVrijemeOdgovor';
import type { ObrisiRadnoVrijemeZahtjev } from '../definitions/ObrisiRadnoVrijemeZahtjev';
import type { PrijaviRadnoVrijemeOdgovor } from '../definitions/PrijaviRadnoVrijemeOdgovor';
import type { PrijaviRadnoVrijemeZahtjev } from '../definitions/PrijaviRadnoVrijemeZahtjev';
import type { PromijeniNacPlacOdgovor } from '../definitions/PromijeniNacPlacOdgovor';
import type { PromijeniNacPlacZahtjev } from '../definitions/PromijeniNacPlacZahtjev';
import type { PromijeniPodatkeRacunaOdgovor } from '../definitions/PromijeniPodatkeRacunaOdgovor';
import type { PromijeniPodatkeRacunaZahtjev } from '../definitions/PromijeniPodatkeRacunaZahtjev';
import type { ProvjeraOdgovor } from '../definitions/ProvjeraOdgovor';
import type { ProvjeraZahtjev } from '../definitions/ProvjeraZahtjev';
import type { RacunOdgovor } from '../definitions/RacunOdgovor';
import type { RacunZahtjev } from '../definitions/RacunZahtjev';
import type { String } from '../definitions/String';
import type { String1 } from '../definitions/String1';

export interface FiskalizacijaPortType {
    racuni(
        racunZahtjev: RacunZahtjev,
        callback: (
            err: any,
            result: RacunOdgovor,
            rawResponse: any,
            soapHeader: any,
            rawRequest: any,
        ) => void,
    ): void;
    provjera(
        provjeraZahtjev: ProvjeraZahtjev,
        callback: (
            err: any,
            result: ProvjeraOdgovor,
            rawResponse: any,
            soapHeader: any,
            rawRequest: any,
        ) => void,
    ): void;
    promijeniNacPlac(
        promijeniNacPlacZahtjev: PromijeniNacPlacZahtjev,
        callback: (
            err: any,
            result: PromijeniNacPlacOdgovor,
            rawResponse: any,
            soapHeader: any,
            rawRequest: any,
        ) => void,
    ): void;
    napojnica(
        napojnicaZahtjev: NapojnicaZahtjev,
        callback: (
            err: any,
            result: NapojnicaOdgovor,
            rawResponse: any,
            soapHeader: any,
            rawRequest: any,
        ) => void,
    ): void;
    promijeniPodatkeRacuna(
        promijeniPodatkeRacunaZahtjev: PromijeniPodatkeRacunaZahtjev,
        callback: (
            err: any,
            result: PromijeniPodatkeRacunaOdgovor,
            rawResponse: any,
            soapHeader: any,
            rawRequest: any,
        ) => void,
    ): void;
    prijaviRadnoVrijeme(
        prijaviRadnoVrijemeZahtjev: PrijaviRadnoVrijemeZahtjev,
        callback: (
            err: any,
            result: PrijaviRadnoVrijemeOdgovor,
            rawResponse: any,
            soapHeader: any,
            rawRequest: any,
        ) => void,
    ): void;
    obrisiRadnoVrijeme(
        obrisiRadnoVrijemeZahtjev: ObrisiRadnoVrijemeZahtjev,
        callback: (
            err: any,
            result: ObrisiRadnoVrijemeOdgovor,
            rawResponse: any,
            soapHeader: any,
            rawRequest: any,
        ) => void,
    ): void;
    dohvatiRadnoVrijeme(
        dohvatiRadnoVrijemeZahtjev: DohvatiRadnoVrijemeZahtjev,
        callback: (
            err: any,
            result: DohvatiRadnoVrijemeOdgovor,
            rawResponse: any,
            soapHeader: any,
            rawRequest: any,
        ) => void,
    ): void;
    echo(
        echoRequest: String,
        callback: (
            err: any,
            result: String1,
            rawResponse: any,
            soapHeader: any,
            rawRequest: any,
        ) => void,
    ): void;
}
