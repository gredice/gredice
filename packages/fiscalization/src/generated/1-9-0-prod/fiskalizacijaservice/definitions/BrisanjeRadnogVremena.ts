import type { Iznimke1 } from './Iznimke1';
import type { Redovno1 } from './Redovno1';

/**
 * BrisanjeRadnogVremena
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.apis-it.hr/fin/2012/types/f73`
 */
export interface BrisanjeRadnogVremena {
    /** Redovno[] */
    Redovno?: Array<Redovno1>;
    /** Iznimke[] */
    Iznimke?: Array<Iznimke1>;
}
