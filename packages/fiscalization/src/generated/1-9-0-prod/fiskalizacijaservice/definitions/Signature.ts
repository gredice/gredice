import type { KeyInfo } from './KeyInfo';
import type { Object } from './Object';
import type { SignedInfo } from './SignedInfo';

/**
 * Signature
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface Signature {
    /** SignedInfo */
    SignedInfo?: SignedInfo;
    /** base64Binary */
    SignatureValue?: string;
    /** KeyInfo */
    KeyInfo?: KeyInfo;
    /** Object */
    Object?: Object;
}
