import forge from 'node-forge';

export function getPkcs12KeyPair(p12Buffer: string, password: string) {
    const p12Asn1 = forge.asn1.fromDer(p12Buffer);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    // Private key
    const index = forge.pki.oids.pkcs8ShroudedKeyBag;
    const keyBags = forge.pki.oids.keyBag;
    if (index === undefined || keyBags === undefined) {
        throw new Error('index not defined');
    }
    const keyData = p12.getBags({
        bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
    });
    if (keyData === undefined) {
        throw new Error('Key data is undefined');
    }
    const pkcs8Key = keyData[index]?.at(0) ?? keyData[keyBags]?.at(0);
    if (!pkcs8Key?.key) {
        throw new Error('Unable to get private key.');
    }

    // Certificate
    const bagType = forge.pki.oids.certBag;
    if (bagType === undefined) {
        throw new Error();
    }
    const certData = p12.getBags({ bagType })[bagType] ?? [];
    const { cert } = certData.at(0) ?? {};
    if (cert === undefined) {
        throw new Error();
    }

    // Convert to PEM format
    const keyPem = forge.pki.privateKeyToPem(pkcs8Key.key);
    const certPem = forge.pki.certificateToPem(cert);

    return {
        keyPem,
        certPem,
        issuer: cert.subject.attributes,
        serialNumber: BigInt(`0x${cert.serialNumber}`).toString(),
    };
}
