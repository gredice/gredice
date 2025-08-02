import { RadnoVrijeme } from "./RadnoVrijeme";
import { BrisanjeRadnogVremena } from "./BrisanjeRadnogVremena";

/**
 * PoslovniProstor
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.apis-it.hr/fin/2012/types/f73`
 */
export interface PoslovniProstor {
    /** OibType|string|length,pattern */
    Oib?: string;
    /** OznPoslProstoraType|string|minLength,maxLength,pattern */
    OznPosPr?: string;
    /** RadnoVrijeme */
    RadnoVrijeme?: RadnoVrijeme;
    /** BrisanjeRadnogVremena */
    BrisanjeRadnogVremena?: BrisanjeRadnogVremena;
    /** OibType|string|length,pattern */
    OibOper?: string;
}
