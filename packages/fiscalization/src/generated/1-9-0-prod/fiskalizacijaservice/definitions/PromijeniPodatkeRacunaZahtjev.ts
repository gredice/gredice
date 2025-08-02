import { Zaglavlje } from "./Zaglavlje";
import { Racun3 } from "./Racun3";
import { Signature } from "./Signature";

/**
 * PromijeniPodatkeRacunaZahtjev
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface PromijeniPodatkeRacunaZahtjev {
    /** Zaglavlje */
    Zaglavlje?: Zaglavlje;
    /** Racun */
    Racun?: Racun3;
    /** Signature */
    Signature?: Signature;
}
