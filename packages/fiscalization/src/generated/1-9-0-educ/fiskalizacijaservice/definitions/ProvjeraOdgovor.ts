import { Zaglavlje1 } from "./Zaglavlje1";
import { Racun } from "./Racun";
import { Greske } from "./Greske";
import { Signature } from "./Signature";

/**
 * ProvjeraOdgovor
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface ProvjeraOdgovor {
    /** Zaglavlje */
    Zaglavlje?: Zaglavlje1;
    /** Racun */
    Racun?: Racun;
    /** Greske */
    Greske?: Greske;
    /** Signature */
    Signature?: Signature;
}
