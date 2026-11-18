package com.overdrive.app.telegram.impl;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import com.overdrive.app.telegram.IOwnerStore;
import com.overdrive.app.telegram.model.NotificationPreferences;
import com.overdrive.app.telegram.model.OwnerInfo;
import org.junit.Test;

/**
 * Security fix F3: a 6-digit pairing PIN had no attempt limit, so a bot user could
 * brute-force it within its 5-minute window. After MAX_PIN_ATTEMPTS wrong guesses
 * the PIN is burned and the owner must generate a new one in the app.
 */
public class PairingManagerAttemptLimitTest {

    private static final class MemoryOwnerStore implements IOwnerStore {
        OwnerInfo owner;
        @Override public void saveOwner(OwnerInfo o) { owner = o; }
        @Override public OwnerInfo getOwner() { return owner; }
        @Override public boolean hasOwner() { return owner != null; }
        @Override public void clearOwner() { owner = null; }
        @Override public void savePreferences(NotificationPreferences p) { }
        @Override public NotificationPreferences getPreferences() { return null; }
    }

    private static String wrong(String pin) {
        return pin.equals("123456") ? "654321" : "123456";
    }

    @Test
    public void correctPinStillPairsAfterAFewWrongGuesses() {
        MemoryOwnerStore store = new MemoryOwnerStore();
        PairingManager pm = new PairingManager(store);
        String pin = pm.generatePin().getPin();

        for (int i = 0; i < PairingManager.MAX_PIN_ATTEMPTS - 1; i++) {
            assertFalse(pm.validateAndPair(wrong(pin), 42L, "u", "f"));
        }
        assertTrue(pm.validateAndPair(pin, 42L, "u", "f"));
    }

    @Test
    public void pinIsBurnedAfterTooManyWrongGuesses() {
        MemoryOwnerStore store = new MemoryOwnerStore();
        PairingManager pm = new PairingManager(store);
        String pin = pm.generatePin().getPin();

        for (int i = 0; i < PairingManager.MAX_PIN_ATTEMPTS; i++) {
            assertFalse(pm.validateAndPair(wrong(pin), 666L, "attacker", "a"));
        }
        assertNull("PIN must be cleared after the limit", pm.getCurrentPinState());
        assertFalse("even the right PIN is refused once burned",
                pm.validateAndPair(pin, 666L, "attacker", "a"));
        assertNull(store.getOwner());
    }

    @Test
    public void newPinResetsTheCounter() {
        PairingManager pm = new PairingManager(new MemoryOwnerStore());
        String first = pm.generatePin().getPin();
        for (int i = 0; i < PairingManager.MAX_PIN_ATTEMPTS; i++) {
            pm.validateAndPair(wrong(first), 1L, "u", "f");
        }
        String second = pm.generatePin().getPin();
        assertTrue(pm.validateAndPair(second, 1L, "u", "f"));
    }
}
