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

/** F1: stored "ENC:" values move to "ENC2:" only when the key is held and the new value reads back the same. */
public class CredentialCipherMigrationTest {

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

    // ── migration (stage 3) ──

    @Test
    public void upgradeMovesLegacyEncToEnc2WhenKeyAvailable() {
        keyAvailable = false;
        String legacy = CredentialCipher.encrypt("mqtt-pass");
        keyAvailable = true;
        assertTrue(CredentialCipher.needsStableReEncrypt(legacy));
        String upgraded = CredentialCipher.upgradeToStableOrNull(legacy);
        assertTrue(String.valueOf(upgraded), upgraded != null && upgraded.startsWith("ENC2:"));
        assertEquals("mqtt-pass", CredentialCipher.decrypt(upgraded));
    }

    @Test
    public void upgradeLeavesLegacyEncWhenKeyMissing() {
        keyAvailable = false;
        String legacy = CredentialCipher.encrypt("mqtt-pass");
        assertFalse(CredentialCipher.needsStableReEncrypt(legacy));
        assertNull(CredentialCipher.upgradeToStableOrNull(legacy));
    }

    @Test
    public void upgradeOnlyWhereTheKeyIsOwned() {
        keyAvailable = false;
        String legacy = CredentialCipher.encrypt("mqtt-pass");
        // The app's copy may be stale (a restore changed the daemons' key): a value moved under it could become
        // unreadable to the daemons, so only the key's owner migrates.
        CredentialCipher.useKeySource(new CredentialCipher.KeySource() {
            @Override
            public byte[] key() {
                return key.clone();
            }

            @Override
            public boolean ownsKey() {
                return false;
            }
        });
        assertFalse(CredentialCipher.needsStableReEncrypt(legacy));
        assertNull(CredentialCipher.upgradeToStableOrNull(legacy));
    }

    @Test
    public void upgradeLeavesEnc2Alone() {
        String enc2 = CredentialCipher.encrypt("x");
        assertFalse(CredentialCipher.needsStableReEncrypt(enc2));
        assertNull(CredentialCipher.upgradeToStableOrNull(enc2));
    }

    @Test
    public void upgradeRefusesWhenRoundTripFails() {
        keyAvailable = false;
        String legacy = CredentialCipher.encrypt("mqtt-pass");
        keyAvailable = true;
        // A key that changes between encrypt and the verifying decrypt (another process replaced it) must not be
        // committed over a working value.
        CredentialCipher.useKeySource(new CredentialCipher.KeySource() {
            private int calls;

            @Override
            public byte[] key() {
                byte[] k = new byte[32];
                k[0] = (byte) calls++;
                return k;
            }
        });
        assertNull(CredentialCipher.upgradeToStableOrNull(legacy));
    }

    @Test
    public void upgradeLeavesUndecryptableLegacyAlone() {
        assertNull(CredentialCipher.upgradeToStableOrNull("ENC:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"));
        assertNotEquals(Boolean.TRUE, CredentialCipher.needsStableReEncrypt("ENC:AAAA"));
    }
}
