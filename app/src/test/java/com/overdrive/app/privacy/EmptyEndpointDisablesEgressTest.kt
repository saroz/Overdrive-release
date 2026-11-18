package com.overdrive.app.privacy

import com.overdrive.app.BuildConfig
import com.overdrive.app.analytics.AnalyticsPinger
import com.overdrive.app.community.sync.CommunitySyncProvider
import com.overdrive.app.community.sync.CommunityWidgetSync
import com.overdrive.app.roadsense.config.RoadSenseConfig
import com.overdrive.app.roadsense.sync.CloudflareEdgeSyncProvider
import okhttp3.OkHttpClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Privacy G3 behaviour: an empty / blank worker URL means "disabled" — every cloud
 * client fails closed WITHOUT building an HTTP client (so no socket is ever opened),
 * and the periodic RoadSense sync never even schedules an attempt.
 */
class EmptyEndpointDisablesEgressTest {

    private val blanks = listOf<String?>(null, "", "   ")

    /** A client factory that records whether anyone tried to talk to the network. */
    private class CountingFactory : () -> OkHttpClient {
        var calls = 0
        override fun invoke(): OkHttpClient {
            calls++
            throw AssertionError("network client requested with no worker URL configured")
        }
    }

    @Test
    fun roadSenseProviderFailsClosedWithoutNetwork() {
        for (url in blanks) {
            val net = CountingFactory()
            val p = CloudflareEdgeSyncProvider({ url }, net)
            val down = p.download(listOf(1L, 2L), emptyMap())
            assertFalse(down.ok)
            assertTrue(down.hazards.isEmpty())
            val up = p.upload(emptyList(), "dev")
            assertFalse(up.ok)
            assertFalse(p.deleteOwnUploads("dev"))
            assertEquals("no HTTP client may be built for url=$url", 0, net.calls)
        }
    }

    @Test
    fun communityProvidersFailClosedWithNotConfiguredError() {
        for (url in blanks) {
            val net = CountingFactory()
            val r = CommunitySyncProvider({ url }, net).list("")
            assertFalse(r.ok)
            assertTrue(r.error!!.contains("not configured"))
            assertEquals(0, net.calls)

            val wnet = CountingFactory()
            val w = CommunityWidgetSync({ url }, wnet).list("")
            assertFalse(w.ok)
            assertTrue(w.error!!.contains("not configured"))
            assertEquals(0, wnet.calls)
        }
    }

    @Test
    fun roadSenseCrowdSyncInactiveWithoutWorkerUrl() {
        for (url in blanks) {
            assertFalse(RoadSenseConfig.crowdSyncActive(true, true, url))
            assertFalse(RoadSenseConfig.crowdSyncActive(true, false, url))
            assertFalse(RoadSenseConfig.crowdSyncActive(false, true, url))
        }
        val own = "https://my-worker.example.com"
        assertFalse("both toggles off → no sync", RoadSenseConfig.crowdSyncActive(false, false, own))
        assertTrue(RoadSenseConfig.crowdSyncActive(true, false, own))
        assertTrue(RoadSenseConfig.crowdSyncActive(false, true, own))
    }

    @Test
    fun analyticsBaseUrlIsNullWhenNothingConfigured() {
        for (a in blanks) for (b in blanks) {
            assertNull(AnalyticsPinger.resolveBaseUrl(a, b))
        }
        assertEquals("https://mine.example", AnalyticsPinger.resolveBaseUrl(" https://mine.example/ ", ""))
        assertEquals("https://build.example", AnalyticsPinger.resolveBaseUrl("", "https://build.example/"))
        assertEquals("https://mine.example", AnalyticsPinger.resolveBaseUrl("https://mine.example", "https://build.example"))
    }

    @Test
    fun compiledDefaultsCarryNoUpstreamHost() {
        val compiled = listOf(
            BuildConfig.ANALYTICS_WORKER_URL,
            BuildConfig.COMMUNITY_WORKER_URL,
            BuildConfig.ROADSENSE_WORKER_URL,
            BuildConfig.LOG_UPLOAD_URL,
        )
        for (v in compiled) {
            for (host in NoUpstreamEndpointsContractTest.UPSTREAM_HOSTS) {
                assertFalse("compiled default '$v' points at upstream host $host", v.lowercase().contains(host))
            }
        }
        assertEquals("debug/release log upload must be off by default", "", BuildConfig.LOG_UPLOAD_URL)
    }
}
