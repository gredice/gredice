
/**
 * RSAKeyValue
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface RsaKeyValue {
    /** CryptoBinary|base64Binary */
    Modulus?: string;
    /** CryptoBinary|base64Binary */
    Exponent?: string;
}
