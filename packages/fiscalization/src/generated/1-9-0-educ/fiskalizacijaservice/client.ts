import { Client as SoapClient, createClientAsync as soapCreateClientAsync, IExOptions as ISoapExOptions } from "soap";
import { RacunZahtjev } from "./definitions/RacunZahtjev";
import { RacunOdgovor } from "./definitions/RacunOdgovor";
import { ProvjeraZahtjev } from "./definitions/ProvjeraZahtjev";
import { ProvjeraOdgovor } from "./definitions/ProvjeraOdgovor";
import { PromijeniNacPlacZahtjev } from "./definitions/PromijeniNacPlacZahtjev";
import { PromijeniNacPlacOdgovor } from "./definitions/PromijeniNacPlacOdgovor";
import { NapojnicaZahtjev } from "./definitions/NapojnicaZahtjev";
import { NapojnicaOdgovor } from "./definitions/NapojnicaOdgovor";
import { PromijeniPodatkeRacunaZahtjev } from "./definitions/PromijeniPodatkeRacunaZahtjev";
import { PromijeniPodatkeRacunaOdgovor } from "./definitions/PromijeniPodatkeRacunaOdgovor";
import { PrijaviRadnoVrijemeZahtjev } from "./definitions/PrijaviRadnoVrijemeZahtjev";
import { PrijaviRadnoVrijemeOdgovor } from "./definitions/PrijaviRadnoVrijemeOdgovor";
import { ObrisiRadnoVrijemeZahtjev } from "./definitions/ObrisiRadnoVrijemeZahtjev";
import { ObrisiRadnoVrijemeOdgovor } from "./definitions/ObrisiRadnoVrijemeOdgovor";
import { DohvatiRadnoVrijemeZahtjev } from "./definitions/DohvatiRadnoVrijemeZahtjev";
import { DohvatiRadnoVrijemeOdgovor } from "./definitions/DohvatiRadnoVrijemeOdgovor";
import { String } from "./definitions/String";
import { String1 } from "./definitions/String1";
import { FiskalizacijaService } from "./services/FiskalizacijaService";

export interface FiskalizacijaServiceClient extends SoapClient {
    FiskalizacijaService: FiskalizacijaService;
    racuniAsync(racunZahtjev: RacunZahtjev, options?: ISoapExOptions): Promise<[result: RacunOdgovor, rawResponse: any, soapHeader: any, rawRequest: any]>;
    provjeraAsync(provjeraZahtjev: ProvjeraZahtjev, options?: ISoapExOptions): Promise<[result: ProvjeraOdgovor, rawResponse: any, soapHeader: any, rawRequest: any]>;
    promijeniNacPlacAsync(promijeniNacPlacZahtjev: PromijeniNacPlacZahtjev, options?: ISoapExOptions): Promise<[result: PromijeniNacPlacOdgovor, rawResponse: any, soapHeader: any, rawRequest: any]>;
    napojnicaAsync(napojnicaZahtjev: NapojnicaZahtjev, options?: ISoapExOptions): Promise<[result: NapojnicaOdgovor, rawResponse: any, soapHeader: any, rawRequest: any]>;
    promijeniPodatkeRacunaAsync(promijeniPodatkeRacunaZahtjev: PromijeniPodatkeRacunaZahtjev, options?: ISoapExOptions): Promise<[result: PromijeniPodatkeRacunaOdgovor, rawResponse: any, soapHeader: any, rawRequest: any]>;
    prijaviRadnoVrijemeAsync(prijaviRadnoVrijemeZahtjev: PrijaviRadnoVrijemeZahtjev, options?: ISoapExOptions): Promise<[result: PrijaviRadnoVrijemeOdgovor, rawResponse: any, soapHeader: any, rawRequest: any]>;
    obrisiRadnoVrijemeAsync(obrisiRadnoVrijemeZahtjev: ObrisiRadnoVrijemeZahtjev, options?: ISoapExOptions): Promise<[result: ObrisiRadnoVrijemeOdgovor, rawResponse: any, soapHeader: any, rawRequest: any]>;
    dohvatiRadnoVrijemeAsync(dohvatiRadnoVrijemeZahtjev: DohvatiRadnoVrijemeZahtjev, options?: ISoapExOptions): Promise<[result: DohvatiRadnoVrijemeOdgovor, rawResponse: any, soapHeader: any, rawRequest: any]>;
    echoAsync(echoRequest: String, options?: ISoapExOptions): Promise<[result: String1, rawResponse: any, soapHeader: any, rawRequest: any]>;
}

/** Create FiskalizacijaServiceClient */
export function createClientAsync(...args: Parameters<typeof soapCreateClientAsync>): Promise<FiskalizacijaServiceClient> {
    return soapCreateClientAsync(args[0], args[1], args[2]) as any;
}
