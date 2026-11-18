package com.overdrive.app.byd.cloud.crypto;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.security.SecureRandom;

/**
 * F1: credentials are encrypted ("ENC2:") under a random key that only the daemons and the app hold, instead of a
 * key anyone can rebuild from the world-readable device-id file ("ENC:"). Old "ENC:" values keep decrypting.
 */
public class CredentialCipherEnc2Test {

    private static final String DID = "test-device-id-0123456789";

    private byte[] key;
    private boolean keyAvailable;
    private int rejected;

    @Before
    public void setUp() {
        key = new byte[32];
        new SecureRandom().nextBytes(key);
        keyAvailable = true;
        rejected = 0;
        CredentialCipher.useKeySource(new CredentialCipher.KeySource() {
            @Override
            public byte[] key() {
                return keyAvailable ? key.clone() : null;
            }

            @Override
            public void keyRejected() {
                rejected++;
            }
        });
        CredentialCipher.useDeviceIdSource(() -> DID);
    }

    @After
    public void tearDown() {
        CredentialCipher.useKeySource(null);
        CredentialCipher.useDeviceIdSource(null);
    }

    @Test
    public void encryptUsesEnc2WhenKeyAvailableAndRoundTrips() {
        String enc = CredentialCipher.encrypt("bot-token:123");
        assertTrue(enc, enc.startsWith("ENC2:"));
        assertTrue(CredentialCipher.isEncrypted(enc));
        assertEquals("bot-token:123", CredentialCipher.decrypt(enc));
    }

    @Test
    public void enc2DoesNotDecryptUnderDeviceIdAlone() {
        String enc = CredentialCipher.encrypt("secret");
        keyAvailable = false;
        assertEquals("", CredentialCipher.decrypt(enc));
        assertTrue("the key source is told so the app can fetch the key", rejected > 0);
    }

    @Test
    public void enc2UnderAnotherKeyFailsClosed() {
        String enc = CredentialCipher.encrypt("secret");
        new SecureRandom().nextBytes(key);
        assertEquals("", CredentialCipher.decrypt(enc));
        assertTrue(rejected > 0);
    }

    @Test
    public void malformedEnc2FailsClosed() {
        assertEquals("", CredentialCipher.decrypt("ENC2:!!!notbase64"));
        assertEquals("", CredentialCipher.decrypt("ENC2:AAAA"));
    }

    @Test
    public void encryptWithoutKeyFallsBackToLegacyEnc() {
        keyAvailable = false;
        String enc = CredentialCipher.encrypt("secret");
        assertTrue(enc, enc.startsWith("ENC:"));
        assertEquals("secret", CredentialCipher.decrypt(enc));
    }

    @Test
    public void legacyEncStillDecryptsWithKeyPresent() {
        keyAvailable = false;
        String legacy = CredentialCipher.encrypt("old-password");
        assertTrue(legacy.startsWith("ENC:"));
        keyAvailable = true;
        assertEquals("old-password", CredentialCipher.decrypt(legacy));
    }

    @Test
    public void isEncryptedRecognisesBothPrefixes() {
        assertTrue(CredentialCipher.isEncrypted("ENC:abc"));
        assertTrue(CredentialCipher.isEncrypted("ENC2:abc"));
        assertFalse(CredentialCipher.isEncrypted("plain"));
        assertFalse(CredentialCipher.isEncrypted(null));
        assertFalse(CredentialCipher.isEncrypted(""));
    }

    @Test
    public void encryptLeavesEncryptedValuesAlone() {
        assertEquals("ENC2:abc", CredentialCipher.encrypt("ENC2:abc"));
        assertEquals("ENC:abc", CredentialCipher.encrypt("ENC:abc"));
    }

    @Test
    public void plaintextPassesThroughDecrypt() {
        assertEquals("plain", CredentialCipher.decrypt("plain"));
    }

    @Test
    public void undecryptableOnlyForEncryptedValuesThatFail() {
        String enc = CredentialCipher.encrypt("secret");
        assertFalse(CredentialCipher.isUndecryptable(enc));
        assertFalse(CredentialCipher.isUndecryptable(""));
        assertFalse(CredentialCipher.isUndecryptable("plain"));
        keyAvailable = false;
        assertTrue(CredentialCipher.isUndecryptable(enc));
    }
}
