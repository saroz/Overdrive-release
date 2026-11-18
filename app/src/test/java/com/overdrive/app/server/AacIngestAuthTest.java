package com.overdrive.app.server;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PushbackInputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

/**
 * Security fix F14, port 19878: the audio ingest reads an AUTH frame before a client may take the
 * mic slot. Exercised over a real loopback socket pair.
 */
public class AacIngestAuthTest {

    private static final int MSG_CONFIG = 1;

    private ServerSocket server;
    private Socket client;
    private Socket accepted;

    @Before
    public void connect() throws IOException {
        server = new ServerSocket(0, 1, InetAddress.getLoopbackAddress());
        client = new Socket(InetAddress.getLoopbackAddress(), server.getLocalPort());
        accepted = server.accept();
        accepted.setSoTimeout(4000);
    }

    @After
    public void close() throws IOException {
        accepted.close();
        client.close();
        server.close();
    }

    @Test
    public void authFrameIsConsumedAndTheNextFrameIsIntact() throws IOException {
        byte[] config = configFrame();
        send(frame(AacIngestServer.MSG_AUTH, "not.a.token".getBytes(StandardCharsets.UTF_8)), config);

        PushbackInputStream in = new PushbackInputStream(accepted.getInputStream(), 8);
        String reason = AacIngestServer.readAuthFrame(accepted, in);

        assertNotNull("a bad token must be reported", reason);
        assertArrayEquals(config, readExactly(in, config.length));
        assertEquals("the read timeout is restored", 4000, accepted.getSoTimeout());
    }

    @Test
    public void emptyTokenIsReportedAsNoToken() throws IOException {
        send(frame(AacIngestServer.MSG_AUTH, new byte[0]));
        PushbackInputStream in = new PushbackInputStream(accepted.getInputStream(), 8);
        assertEquals("no token", AacIngestServer.readAuthFrame(accepted, in));
    }

    @Test
    public void clientWithoutAuthKeepsItsBytes() throws IOException {
        byte[] config = configFrame();
        send(config);

        PushbackInputStream in = new PushbackInputStream(accepted.getInputStream(), 8);
        assertEquals("no auth frame", AacIngestServer.readAuthFrame(accepted, in));
        assertArrayEquals("log-only: the CONFIG frame must still be readable",
                config, readExactly(in, config.length));
    }

    @Test
    public void silentClientTimesOutWithoutBlockingForever() throws IOException {
        PushbackInputStream in = new PushbackInputStream(accepted.getInputStream(), 8);
        long start = System.nanoTime();
        assertEquals("no auth frame", AacIngestServer.readAuthFrame(accepted, in));
        long ms = (System.nanoTime() - start) / 1_000_000;
        assertTrue("waited " + ms + " ms", ms < 3000);
        assertEquals(4000, accepted.getSoTimeout());
    }

    @Test
    public void oversizedAuthFrameIsRejected() throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        DataOutputStream out = new DataOutputStream(bytes);
        out.writeInt(1_000_000);
        out.writeInt(AacIngestServer.MSG_AUTH);
        send(bytes.toByteArray());
        PushbackInputStream in = new PushbackInputStream(accepted.getInputStream(), 8);
        assertEquals("bad auth frame", AacIngestServer.readAuthFrame(accepted, in));
    }

    @Test
    public void serverChecksBeforeEvictingAndAppSendsAuthFirst() throws IOException {
        String server = read("app/src/main/java/com/overdrive/app/server/AacIngestServer.java");
        int check = server.indexOf("unauthorized = readAuthFrame(client, clientIn);");
        int evict = server.indexOf("Socket previous = activeClient;");
        assertTrue(check > 0);
        assertTrue("the token must be checked before the client replaces the active one",
                evict > check);
        assertTrue(server.contains("if (IpcAuth.ENFORCE) {"));
        assertTrue(server.contains("in = new DataInputStream(source);"));

        String app = read("app/src/main/java/com/overdrive/app/audio/AppAudioCaptureController.java");
        int auth = app.indexOf("out.writeInt(MSG_AUTH);");
        assertTrue(auth > 0);
        assertTrue("AUTH before LISTENER_ONLY", app.indexOf("out.writeInt(MSG_LISTENER_ONLY);") > auth);
        assertTrue("AUTH before CONFIG", app.indexOf("out.writeInt(MSG_CONFIG);") > auth);
        assertTrue(app.contains("private static final int MSG_AUTH = 5;"));
    }

    private void send(byte[]... frames) throws IOException {
        OutputStream out = client.getOutputStream();
        for (byte[] f : frames) out.write(f);
        out.flush();
    }

    private static byte[] frame(int type, byte[] payload) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        DataOutputStream out = new DataOutputStream(bytes);
        out.writeInt(4 + payload.length);
        out.writeInt(type);
        out.write(payload);
        return bytes.toByteArray();
    }

    private static byte[] configFrame() throws IOException {
        ByteArrayOutputStream payload = new ByteArrayOutputStream();
        DataOutputStream p = new DataOutputStream(payload);
        p.writeInt(48_000);
        p.writeInt(1);
        p.writeInt(64_000);
        p.writeInt(2);
        p.write(new byte[] {0x11, (byte) 0x88});
        return frame(MSG_CONFIG, payload.toByteArray());
    }

    private static byte[] readExactly(java.io.InputStream in, int n) throws IOException {
        byte[] b = new byte[n];
        new DataInputStream(in).readFully(b);
        return b;
    }

    private static String read(String relativePath) throws IOException {
        Path current = Paths.get("").toAbsolutePath();
        while (current != null) {
            Path candidate = current.resolve(relativePath);
            if (Files.exists(candidate)) return new String(Files.readAllBytes(candidate), StandardCharsets.UTF_8);
            Path fromModule = current.resolve(relativePath.replaceFirst("^app/", ""));
            if (Files.exists(fromModule)) return new String(Files.readAllBytes(fromModule), StandardCharsets.UTF_8);
            current = current.getParent();
        }
        throw new AssertionError("Could not locate repository path: " + relativePath);
    }
}
