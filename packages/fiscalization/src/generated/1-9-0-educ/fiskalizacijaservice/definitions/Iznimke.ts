import { Jednokratno1 } from "./Jednokratno1";
import { Dvokratno1 } from "./Dvokratno1";

/**
 * Iznimke
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.apis-it.hr/fin/2012/types/f73`
 */
export interface Iznimke {
    /** DatumType|string|length,pattern */
    Datum?: string;
    /** Jednokratno */
    Jednokratno?: Jednokratno1;
    /** Dvokratno[] */
    Dvokratno?: Array<Dvokratno1>;
}
