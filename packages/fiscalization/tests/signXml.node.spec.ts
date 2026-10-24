import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import { signXml } from '../src/clients/signXml';

// Disposable credentials keep the real signing path independent of CIS and
// production certificates.
const keys = forge.pki.rsa.generateKeyPair(2048);
const certificate = forge.pki.createCertificate();
certificate.publicKey = keys.publicKey;
certificate.serialNumber = '01';
certificate.validity.notBefore = new Date('2026-01-01T00:00:00Z');
certificate.validity.notAfter = new Date('2036-01-01T00:00:00Z');
const subject = [
    { name: 'countryName', value: 'HR' },
    { name: 'organizationName', value: 'Gredice test' },
    { shortName: 'OU', value: 'Fiscalization test' },
];
certificate.setSubject(subject);
certificate.setIssuer(subject);
certificate.sign(keys.privateKey, forge.md.sha256.create());
const password = 'disposable-test-certificate';
const credentials = {
    cert: forge.asn1
        .toDer(
            forge.pkcs12.toPkcs12Asn1(keys.privateKey, [certificate], password),
        )
        .getBytes(),
    password,
};
const publicCert = forge.pki.certificateToPem(certificate);
const signatureNamespace = 'http://www.w3.org/2000/09/xmldsig#';
const request = `<?xml version="1.0" encoding="UTF-8"?>
<tns:RacunZahtjev xmlns:tns="http://www.apis-it.hr/fin/2012/types/f73">
    <tns:Zaglavlje><tns:IdPoruke>local-test</tns:IdPoruke></tns:Zaglavlje>
    <tns:Racun><tns:IznosUkupno>12.34</tns:IznosUkupno><tns:Napomena>Čuvaj vrt &amp; povrće</tns:Napomena></tns:Racun>
</tns:RacunZahtjev>`;

test('fiscalization XML signs and verifies with namespaced UTF-8 content', async () => {
    const signed = await signXml(request, 'RacunZahtjev', credentials);
    const doc = new DOMParser().parseFromString(signed, 'text/xml');
    const signatures = doc.getElementsByTagNameNS(
        signatureNamespace,
        'Signature',
    );
    assert.equal(signatures.length, 1);
    const signature = signatures.item(0);
    assert.ok(signature);

    // Signature loading and verification both parse XML internally.
    const verifier = new SignedXml({ publicCert });
    verifier.loadSignature(new XMLSerializer().serializeToString(signature));
    assert.equal(verifier.checkSignature(signed), true);
    assert.equal(verifier.getSignedReferences().length, 1);
    assert.match(
        verifier.getSignedReferences()[0] ?? '',
        /Čuvaj vrt &amp; povrće/,
    );
    assert.equal(
        verifier.checkSignature(signed.replace('12.34', '99.99')),
        false,
    );
});

test('XML transform chains preserve parsing and reject malformed octets', () => {
    const transformUri = 'urn:gredice:test:xml-octets';
    class XmlOctetsTransform {
        getAlgorithmName() {
            return transformUri;
        }
        process() {
            return '<Amount>12.34</Amount>';
        }
    }
    const signer = new SignedXml({
        privateKey: forge.pki.privateKeyToPem(keys.privateKey),
        publicCert,
        canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
        signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    });
    signer.CanonicalizationAlgorithms[transformUri] = XmlOctetsTransform;
    signer.addReference({
        xpath: "//*[local-name(.)='RacunZahtjev']",
        transforms: [transformUri, 'http://www.w3.org/2001/10/xml-exc-c14n#'],
        digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    });
    signer.computeSignature(request);
    const verifier = new SignedXml({ publicCert });
    verifier.CanonicalizationAlgorithms[transformUri] = XmlOctetsTransform;
    verifier.loadSignature(signer.getSignatureXml());
    assert.equal(verifier.checkSignature(signer.getSignedXml()), true);

    class MalformedOctetsTransform extends XmlOctetsTransform {
        process() {
            return '<Amount><Broken></Amount>';
        }
    }
    verifier.CanonicalizationAlgorithms[transformUri] =
        MalformedOctetsTransform;
    assert.throws(
        () => verifier.checkSignature(signer.getSignedXml()),
        /not well-formed XML|ParseError|end tag name/,
    );
});
