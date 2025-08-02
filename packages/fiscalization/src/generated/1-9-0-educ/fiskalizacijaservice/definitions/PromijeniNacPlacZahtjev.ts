import { Zaglavlje } from "./Zaglavlje";
import { Racun1 } from "./Racun1";
import { Signature } from "./Signature";

/**
 * PromijeniNacPlacZahtjev
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface PromijeniNacPlacZahtjev {
    /** Zaglavlje */
    Zaglavlje?: Zaglavlje;
    /** Racun */
    Racun?: Racun1;
    /** Signature */
    Signature?: Signature;
}
