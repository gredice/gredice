import { Zaglavlje } from "./Zaglavlje";
import { Racun } from "./Racun";
import { Signature } from "./Signature";

/**
 * ProvjeraZahtjev
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface ProvjeraZahtjev {
    /** Zaglavlje */
    Zaglavlje?: Zaglavlje;
    /** Racun */
    Racun?: Racun;
    /** Signature */
    Signature?: Signature;
}
