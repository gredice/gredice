import { Redovno } from "./Redovno";
import { Iznimke } from "./Iznimke";

/**
 * RadnoVrijeme
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.apis-it.hr/fin/2012/types/f73`
 */
export interface RadnoVrijeme {
    /** Redovno[] */
    Redovno?: Array<Redovno>;
    /** Iznimke[] */
    Iznimke?: Array<Iznimke>;
}
