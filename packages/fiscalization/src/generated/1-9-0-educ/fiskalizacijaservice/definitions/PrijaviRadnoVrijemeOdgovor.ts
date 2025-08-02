import { Zaglavlje1 } from "./Zaglavlje1";
import { PorukaOdgovora } from "./PorukaOdgovora";
import { Greske } from "./Greske";
import { Signature } from "./Signature";

/**
 * PrijaviRadnoVrijemeOdgovor
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface PrijaviRadnoVrijemeOdgovor {
    /** Zaglavlje */
    Zaglavlje?: Zaglavlje1;
    /** PorukaOdgovora */
    PorukaOdgovora?: PorukaOdgovora;
    /** Greske */
    Greske?: Greske;
    /** Signature */
    Signature?: Signature;
}
