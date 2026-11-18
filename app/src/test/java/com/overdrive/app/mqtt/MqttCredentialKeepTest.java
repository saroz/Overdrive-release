package com.overdrive.app.mqtt;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import com.overdrive.app.byd.cloud.crypto.CredentialCipher;

import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

/**
 * F1 data-loss rule: a process that can't open an ENC2 login (no key yet) reads it as "" and saves the whole list
 * back; the stored value must survive that unchanged.
 */
public class MqttCredentialKeepTest {

    private final byte[] key = new byte[32];
    private boolean keyAvailable = true;

    @Before
    public void setUp() {
        key[0] = 7;
        CredentialCipher.useKeySource(() -> keyAvailable ? key.clone() : null);
    }

    @After
    public void tearDown() {
        CredentialCipher.useKeySource(null);
    }

    @Test
    public void undecryptableLoginIsWrittenBackUnchanged() throws Exception {
        MqttConnectionConfig c = new MqttConnectionConfig();
        c.username = "ha-user";
        c.password = "ha-pass";
        JSONObject stored = c.toJson();
        assertTrue(stored.getString("password").startsWith("ENC2:"));

        keyAvailable = false;
        MqttConnectionConfig read = MqttConnectionConfig.fromJson(stored);
        assertEquals("", read.password);
        JSONObject rewritten = read.toJson();
        assertEquals(stored.getString("username"), rewritten.getString("username"));
        assertEquals(stored.getString("password"), rewritten.getString("password"));

        keyAvailable = true;
        MqttConnectionConfig again = MqttConnectionConfig.fromJson(rewritten);
        assertEquals("ha-user", again.username);
        assertEquals("ha-pass", again.password);
    }

    @Test
    public void aNewPasswordStillReplacesAnUndecryptableOne() throws Exception {
        MqttConnectionConfig c = new MqttConnectionConfig();
        c.password = "old";
        JSONObject stored = c.toJson();
        keyAvailable = false;
        MqttConnectionConfig read = MqttConnectionConfig.fromJson(stored);
        read.password = "new";
        keyAvailable = true;
        assertEquals("new", CredentialCipher.decrypt(read.toJson().getString("password")));
    }
}
