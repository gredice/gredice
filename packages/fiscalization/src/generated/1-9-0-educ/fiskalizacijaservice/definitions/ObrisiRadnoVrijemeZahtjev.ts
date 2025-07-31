import { Zaglavlje } from "./Zaglavlje";
import { PoslovniProstor } from "./PoslovniProstor";
import { Signature } from "./Signature";

/**
 * ObrisiRadnoVrijemeZahtjev
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface ObrisiRadnoVrijemeZahtjev {
    /** Zaglavlje */
    Zaglavlje?: Zaglavlje;
    /** PoslovniProstor */
    PoslovniProstor?: PoslovniProstor;
    /** Signature */
    Signature?: Signature;
}
