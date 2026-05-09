import { SignedXml } from 'xml-crypto';
import { getPkcs12KeyPair } from './pkcs12';

export async function signXml(
    xml: string,
    localName: string,
    creds: { cert: string; password: string },
) {
    const { certPem, keyPem, issuer, serialNumber } = getPkcs12KeyPair(
        creds.cert,
        creds.password,
    );
    // Sign the XML using xml-crypto
    try {
        // Create SignedXml instance
        const sig = new SignedXml({
            privateKey: keyPem,
            publicCert: certPem,
            canonicalizationAlgorithm:
                'http://www.w3.org/2001/10/xml-exc-c14n#',
            signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
            getKeyInfoContent: () => {
                const strippedCert = certPem
                    .toString()
                    .replace(
                        /-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----/g,
                        '',
                    )
                    .replace(/\s+/g, '');

                // Get all attributes and concat them to a string
                const issuerString =
                    `OU=${issuer.find((attr) => attr.shortName === 'OU')?.value || ''},` +
                    `O=${issuer.find((attr) => attr.shortName === 'O')?.value || ''},` +
                    `C=${issuer.find((attr) => attr.shortName === 'C')?.value || ''}`;

                return (
                    `<X509Data>` +
                    ` <X509Certificate>${strippedCert}</X509Certificate>` +
                    ` <X509IssuerSerial>` +
                    `   <X509IssuerName>${issuerString}</X509IssuerName>` +
                    `   <X509SerialNumber>${serialNumber}</X509SerialNumber>` +
                    ` </X509IssuerSerial>` +
                    `</X509Data>`
                );
            },
        });

        // Add reference with transforms
        sig.addReference({
            xpath: `//*[local-name(.)='${localName}']`,
            digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
            transforms: [
                'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
                'http://www.w3.org/2001/10/xml-exc-c14n#',
            ],
        });

        // Compute signature
        sig.computeSignature(xml, {
            location: {
                reference: `//*[local-name(.)='${localName}']`,
                action: 'append',
            },
        });

        return sig.getSignedXml();
    } catch (error: unknown) {
        console.error('Request signing failed:', error);
        const errorMessage =
            error && typeof error === 'object' && 'body' in error
                ? JSON.stringify(error.body)
                : error instanceof Error
                  ? error.message
                  : String(error);
        throw new Error(`Request signing failed: ${errorMessage}`);
    }
}
