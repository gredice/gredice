
/**
 * BrRac
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.apis-it.hr/fin/2012/types/f73`
 */
export interface BrRac {
    /** string|minLength,maxLength,pattern */
    BrOznRac?: string;
    /** OznPoslProstoraType|string|minLength,maxLength,pattern */
    OznPosPr?: string;
    /** OznNaplUredjajaType|string|minLength,maxLength,pattern */
    OznNapUr?: string;
}
