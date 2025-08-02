import { Zaglavlje } from "./Zaglavlje";
import { Racun } from "./Racun";
import { Signature } from "./Signature";

/**
 * RacunZahtjev
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface RacunZahtjev {
    /** Zaglavlje */
    Zaglavlje?: Zaglavlje;
    /** Racun */
    Racun?: Racun;
    /** Signature */
    Signature?: Signature;
}
