import { RacunZahtjev } from "../definitions/RacunZahtjev";
import { RacunOdgovor } from "../definitions/RacunOdgovor";
import { ProvjeraZahtjev } from "../definitions/ProvjeraZahtjev";
import { ProvjeraOdgovor } from "../definitions/ProvjeraOdgovor";
import { PromijeniNacPlacZahtjev } from "../definitions/PromijeniNacPlacZahtjev";
import { PromijeniNacPlacOdgovor } from "../definitions/PromijeniNacPlacOdgovor";
import { NapojnicaZahtjev } from "../definitions/NapojnicaZahtjev";
import { NapojnicaOdgovor } from "../definitions/NapojnicaOdgovor";
import { PromijeniPodatkeRacunaZahtjev } from "../definitions/PromijeniPodatkeRacunaZahtjev";
import { PromijeniPodatkeRacunaOdgovor } from "../definitions/PromijeniPodatkeRacunaOdgovor";
import { PrijaviRadnoVrijemeZahtjev } from "../definitions/PrijaviRadnoVrijemeZahtjev";
import { PrijaviRadnoVrijemeOdgovor } from "../definitions/PrijaviRadnoVrijemeOdgovor";
import { ObrisiRadnoVrijemeZahtjev } from "../definitions/ObrisiRadnoVrijemeZahtjev";
import { ObrisiRadnoVrijemeOdgovor } from "../definitions/ObrisiRadnoVrijemeOdgovor";
import { DohvatiRadnoVrijemeZahtjev } from "../definitions/DohvatiRadnoVrijemeZahtjev";
import { DohvatiRadnoVrijemeOdgovor } from "../definitions/DohvatiRadnoVrijemeOdgovor";
import { String } from "../definitions/String";
import { String1 } from "../definitions/String1";

export interface FiskalizacijaPortType {
    racuni(racunZahtjev: RacunZahtjev, callback: (err: any, result: RacunOdgovor, rawResponse: any, soapHeader: any, rawRequest: any) => void): void;
    provjera(provjeraZahtjev: ProvjeraZahtjev, callback: (err: any, result: ProvjeraOdgovor, rawResponse: any, soapHeader: any, rawRequest: any) => void): void;
    promijeniNacPlac(promijeniNacPlacZahtjev: PromijeniNacPlacZahtjev, callback: (err: any, result: PromijeniNacPlacOdgovor, rawResponse: any, soapHeader: any, rawRequest: any) => void): void;
    napojnica(napojnicaZahtjev: NapojnicaZahtjev, callback: (err: any, result: NapojnicaOdgovor, rawResponse: any, soapHeader: any, rawRequest: any) => void): void;
    promijeniPodatkeRacuna(promijeniPodatkeRacunaZahtjev: PromijeniPodatkeRacunaZahtjev, callback: (err: any, result: PromijeniPodatkeRacunaOdgovor, rawResponse: any, soapHeader: any, rawRequest: any) => void): void;
    prijaviRadnoVrijeme(prijaviRadnoVrijemeZahtjev: PrijaviRadnoVrijemeZahtjev, callback: (err: any, result: PrijaviRadnoVrijemeOdgovor, rawResponse: any, soapHeader: any, rawRequest: any) => void): void;
    obrisiRadnoVrijeme(obrisiRadnoVrijemeZahtjev: ObrisiRadnoVrijemeZahtjev, callback: (err: any, result: ObrisiRadnoVrijemeOdgovor, rawResponse: any, soapHeader: any, rawRequest: any) => void): void;
    dohvatiRadnoVrijeme(dohvatiRadnoVrijemeZahtjev: DohvatiRadnoVrijemeZahtjev, callback: (err: any, result: DohvatiRadnoVrijemeOdgovor, rawResponse: any, soapHeader: any, rawRequest: any) => void): void;
    echo(echoRequest: String, callback: (err: any, result: String1, rawResponse: any, soapHeader: any, rawRequest: any) => void): void;
}
