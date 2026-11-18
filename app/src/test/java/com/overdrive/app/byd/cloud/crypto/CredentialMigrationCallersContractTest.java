package com.overdrive.app.byd.cloud.crypto;

import static com.overdrive.app.byd.cloud.crypto.CredentialPrefixContractTest.between;
import static com.overdrive.app.byd.cloud.crypto.CredentialPrefixContractTest.read;
import static org.junit.Assert.assertTrue;

import java.io.IOException;

import org.junit.Test;

/** F1: credentials kept in the shared config move to ENC2 when the daemons read them. */
public class CredentialMigrationCallersContractTest {

    @Test
    public void existingReadersStillUpgrade() throws IOException {
        assertTrue(read("app/src/main/java/com/overdrive/app/byd/cloud/BydCloudConfig.java")
                .contains("CredentialUpgrade.reEncryptKeyIfLegacy(\"bydCloud\", \"rawPassword\")"));
        assertTrue(read("app/src/main/java/com/overdrive/app/genai/GenAiConfig.java")
                .contains("CredentialUpgrade.reEncryptKeyIfLegacy(SECTION, \"apiKey\")"));
        assertTrue(read("app/src/main/java/com/overdrive/app/navmap/NavMapConfig.java")
                .contains("CredentialUpgrade.reEncryptKeyIfLegacy(SECTION, \"routingApiKey\")"));
        assertTrue(read("app/src/main/java/com/overdrive/app/telegram/config/UnifiedTelegramConfig.java")
                .contains("reEncryptKeyIfLegacy(SECTION, K_BOT_TOKEN)"));
    }

    @Test
    public void cloudflaredTokenUpgradesOnRead() throws IOException {
        String src = read("app/src/main/java/com/overdrive/app/config/CloudflaredPaidConfig.kt");
        String getToken = between(src, "fun getToken(): String {", "fun getArgs(): String {");
        assertTrue(getToken.contains("CredentialUpgrade.reEncryptKeyIfLegacy(\"cloudflared\", \"token\")"));
    }

    @Test
    public void safeKeepSecretsUpgradeOnRead() throws IOException {
        String src = read("app/src/main/java/com/overdrive/app/safekeep/SafeKeepSecrets.java");
        String load = between(src, "private static JSONObject load(String destId) {", "public static JSONObject get(");
        assertTrue(load.contains("CredentialUpgrade.reEncryptKeyIfLegacy(SECTION, destId)"));
    }
}
