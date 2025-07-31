import { Zaglavlje1 } from "./Zaglavlje1";
import { Greske } from "./Greske";
import { Signature } from "./Signature";

/**
 * RacunOdgovor
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface RacunOdgovor {
    /** Zaglavlje */
    Zaglavlje?: Zaglavlje1;
    /** UUIDType|string|pattern */
    Jir?: string;
    /** Greske */
    Greske?: Greske;
    /** Signature */
    Signature?: Signature;
}
