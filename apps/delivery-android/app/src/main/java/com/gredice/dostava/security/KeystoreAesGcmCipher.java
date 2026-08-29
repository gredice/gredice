package com.gredice.dostava.security;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Small AES-GCM boundary whose key material remains inside Android Keystore. */
public final class KeystoreAesGcmCipher {
    private final String keyAlias;

    public KeystoreAesGcmCipher(String keyAlias) {
        this.keyAlias = keyAlias;
    }

    public String encrypt(String value) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
            String iv = Base64.getUrlEncoder().withoutPadding().encodeToString(
                    cipher.getIV()
            );
            String payload = Base64.getUrlEncoder().withoutPadding().encodeToString(
                    cipher.doFinal(value.getBytes(StandardCharsets.UTF_8))
            );
            return iv + "." + payload;
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Unable to encrypt native data", exception);
        }
    }

    public String decrypt(String encrypted) {
        String[] parts = encrypted.split("\\.", -1);
        if (parts.length != 2) throw new IllegalArgumentException("Invalid ciphertext");
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                    Cipher.DECRYPT_MODE,
                    getOrCreateKey(),
                    new GCMParameterSpec(
                            128,
                            Base64.getUrlDecoder().decode(parts[0])
                    )
            );
            return new String(
                    cipher.doFinal(Base64.getUrlDecoder().decode(parts[1])),
                    StandardCharsets.UTF_8
            );
        } catch (GeneralSecurityException | IllegalArgumentException exception) {
            throw new IllegalStateException("Unable to decrypt native data", exception);
        }
    }

    private SecretKey getOrCreateKey() throws GeneralSecurityException {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        try {
            keyStore.load(null);
        } catch (IOException exception) {
            throw new GeneralSecurityException(
                    "Unable to load Android Keystore",
                    exception
            );
        }
        SecretKey existing = (SecretKey) keyStore.getKey(keyAlias, null);
        if (existing != null) return existing;

        KeyGenerator generator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                "AndroidKeyStore"
        );
        generator.init(new KeyGenParameterSpec.Builder(
                keyAlias,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
        return generator.generateKey();
    }
}
