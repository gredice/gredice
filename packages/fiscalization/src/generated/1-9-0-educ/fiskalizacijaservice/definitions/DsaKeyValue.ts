
/**
 * DSAKeyValue
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface DsaKeyValue {
    /** CryptoBinary|base64Binary */
    P?: string;
    /** CryptoBinary|base64Binary */
    Q?: string;
    /** CryptoBinary|base64Binary */
    G?: string;
    /** CryptoBinary|base64Binary */
    Y?: string;
    /** CryptoBinary|base64Binary */
    J?: string;
    /** CryptoBinary|base64Binary */
    Seed?: string;
    /** CryptoBinary|base64Binary */
    PgenCounter?: string;
}
