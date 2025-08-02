import { Zaglavlje1 } from "./Zaglavlje1";
import { PoslovniProstor } from "./PoslovniProstor";
import { Greske } from "./Greske";
import { Signature } from "./Signature";

/**
 * DohvatiRadnoVrijemeOdgovor
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface DohvatiRadnoVrijemeOdgovor {
    /** Zaglavlje */
    Zaglavlje?: Zaglavlje1;
    /** PoslovniProstor */
    PoslovniProstor?: PoslovniProstor;
    /** Greske */
    Greske?: Greske;
    /** Signature */
    Signature?: Signature;
}
