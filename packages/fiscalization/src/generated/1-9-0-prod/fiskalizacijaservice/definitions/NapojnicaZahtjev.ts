import { Zaglavlje } from "./Zaglavlje";
import { Racun2 } from "./Racun2";
import { Signature } from "./Signature";

/**
 * NapojnicaZahtjev
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface NapojnicaZahtjev {
    /** Zaglavlje */
    Zaglavlje?: Zaglavlje;
    /** Racun */
    Racun?: Racun2;
    /** Signature */
    Signature?: Signature;
}
