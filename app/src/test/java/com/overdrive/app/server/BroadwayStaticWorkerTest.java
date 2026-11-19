package com.overdrive.app.server;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.junit.Test;

/** F9 step 2: the Broadway decoder runs from a static same-origin worker, not a patched blob. */
public class BroadwayStaticWorkerTest {

    @Test
    public void workerFileLoadsTheDecoderNextToIt() throws Exception {
        String w = read("app/src/main/assets/web/shared/broadway-worker.js");
        assertTrue(w.contains("importScripts('Decoder.js');"));
        assertTrue(w.contains("'avc.wasm'"));
    }

    @Test
    public void pagesNoLongerBuildABlobWorker() throws Exception {
        for (String f : new String[]{"stream.js", "pip.js"}) {
            String s = read("app/src/main/assets/web/shared/" + f);
            assertTrue(f, s.contains("new URL('../shared/broadway-worker.js', window.location.href).href"));
            assertFalse(f, s.contains("decoderCode"));
            assertFalse(f, s.contains("new Blob([decoderCode]"));
        }
    }

    private static String read(String rel) throws Exception {
        Path p = Paths.get(rel);
        if (!Files.exists(p)) p = Paths.get(rel.replaceFirst("^app/", ""));
        return new String(Files.readAllBytes(p), StandardCharsets.UTF_8);
    }
}
