import { X509IssuerSerial } from "./X509IssuerSerial";

/**
 * X509Data
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface X509Data {
    /** a */
    0?: string;
    /** n */
    1?: string;
    /** y */
    2?: string;
    /** X509IssuerSerial */
    X509IssuerSerial?: X509IssuerSerial;
    /** base64Binary */
    X509SKI?: string;
    /** string */
    X509SubjectName?: string;
    /** base64Binary */
    X509Certificate?: string;
    /** base64Binary */
    X509CRL?: string;
}
