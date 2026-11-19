/* Moved out of local/live-view.html (security fix F9: no inline scripts). */
BYD.cabinListener = {
    lastState: 'idle',
    init: function () {
        var self = this;
        CabinAudio.subscribe(function (status) {
            self.render(status);
        });
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) CabinAudio.stop();
        });
        window.addEventListener('pagehide', function () {
            CabinAudio.stop();
        });
        window.addEventListener('beforeunload', function () {
            CabinAudio.stop();
        });
    },
    toggle: function () {
        CabinAudio.toggle();
    },
    render: function (status) {
        var button = document.getElementById('cabinListenButton');
        if (!button) return;
        var active = status.state === 'live';
        var paused = status.state === 'paused';
        var connecting = status.state === 'connecting';
        var waiting = status.state === 'waiting';
        button.classList.toggle('is-active', active);
        button.classList.toggle('is-paused', paused);
        button.classList.toggle('is-connecting', connecting || waiting);
        button.setAttribute(
            'aria-pressed',
            active || paused || connecting || waiting ? 'true' : 'false');
        var key = active
            ? 'liveview.stop_listening'
            : paused
                ? 'liveview.listening_paused'
                : connecting
                    ? 'liveview.listener_starting'
                    : waiting
                        ? 'liveview.listener_waiting'
                        : 'liveview.listen_cabin';
        var label = BYD.i18n.t(key);
        if (label && label !== key) {
            button.title = label;
            button.setAttribute('aria-label', label);
        }
        if (status.state === 'error'
                && this.lastState !== 'error'
                && BYD.utils
                && BYD.utils.toast) {
            BYD.utils.toast(
                status.reason || BYD.i18n.t('liveview.listener_unavailable'),
                'error');
        }
        this.lastState = status.state;
    }
};

/**
 * Themed replacement for the quality <select>'s option popup. The
 * native <select> remains the value holder, so `.value` reads and
 * writes elsewhere keep working; picking an item writes through to it
 * and fires `change`, which is what starts the quality request.
 */
BYD.qualityMenu = {
    open: false,
    init: function () {
        var native = document.getElementById('qualitySelector');
        var trigger = document.getElementById('qualityMenuTrigger');
        var list = document.getElementById('qualityMenuList');
        if (!native || !trigger || !list) return;
        this.native = native;
        this.trigger = trigger;
        this.list = list;

        var self = this;
        list.innerHTML = '';
        for (var i = 0; i < native.options.length; i++) {
            var opt = native.options[i];
            var item = document.createElement('div');
            item.className = 'quality-menu__option';
            item.setAttribute('role', 'option');
            item.setAttribute('data-value', opt.value);
            item.textContent = opt.textContent;
            list.appendChild(item);
        }

        list.addEventListener('click', function (e) {
            var item = e.target;
            while (item && item !== list && !item.getAttribute('data-value')) {
                item = item.parentNode;
            }
            if (item && item !== list) self.pick(item.getAttribute('data-value'));
        });
        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            self.toggle();
        });
        document.addEventListener('click', function (e) {
            if (self.open && !list.contains(e.target)) self.close();
        });
        document.addEventListener('keydown', function (e) {
            if (self.open && (e.key === 'Escape' || e.keyCode === 27)) self.close();
        });
        window.addEventListener('resize', function () { self.close(); });

        this.sync();
    },

    /** Mirrors the native element's value into the trigger and list. */
    sync: function () {
        if (!this.native) return;
        var value = this.native.value;
        var selected = this.native.options[this.native.selectedIndex];
        var valueEl = document.getElementById('qualityMenuValue');
        if (valueEl && selected) valueEl.textContent = selected.textContent;
        var items = this.list.children;
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.textContent = this.native.options[i]
                ? this.native.options[i].textContent
                : item.textContent;
            item.setAttribute('aria-selected',
                item.getAttribute('data-value') === value ? 'true' : 'false');
        }
    },

    pick: function (value) {
        if (!this.native) return;
        this.close();
        if (value === this.native.value) return;
        this.native.value = value;
        this.sync();
        this.native.dispatchEvent(new Event('change'));
    },

    toggle: function () { this.open ? this.close() : this.show(); },

    show: function () {
        if (!this.list) return;
        this.sync();
        this.list.classList.add('is-open');
        this.trigger.setAttribute('aria-expanded', 'true');
        this.open = true;
        this.position();
    },

    close: function () {
        if (!this.list) return;
        this.list.classList.remove('is-open');
        this.trigger.setAttribute('aria-expanded', 'false');
        this.open = false;
    },

    /**
     * Anchors the panel to the trigger's trailing edge, opening on
     * whichever side has room. Windowed head-unit heights can be
     * shorter than the list, so the chosen side also caps its height.
     */
    position: function () {
        var GAP = 6;
        var EDGE = 8;
        var anchor = this.trigger.getBoundingClientRect();
        var list = this.list;
        list.style.minWidth = anchor.width + 'px';
        list.style.maxHeight = '';

        var spaceBelow = window.innerHeight - anchor.bottom - GAP - EDGE;
        var spaceAbove = anchor.top - GAP - EDGE;
        var below = list.offsetHeight <= spaceBelow || spaceBelow >= spaceAbove;
        var space = below ? spaceBelow : spaceAbove;
        if (list.offsetHeight > space) {
            list.style.maxHeight = Math.max(120, space) + 'px';
        }

        var height = list.offsetHeight;
        list.style.top = (below
            ? anchor.bottom + GAP
            : Math.max(EDGE, anchor.top - height - GAP)) + 'px';
        var left = anchor.right - list.offsetWidth;
        list.style.left = Math.max(EDGE,
            Math.min(left, window.innerWidth - list.offsetWidth - EDGE)) + 'px';
    }
};

BYD.liveLayout = {
    mapExpanded: false,
    setMapExpanded: function (expanded) {
        expanded = !!expanded;
        var panel = document.getElementById('panelCameras');
        var button = document.getElementById('locationExpandButton');
        var label = document.getElementById('locationExpandLabel');
        if (!panel) return;

        this.mapExpanded = expanded;
        // Publish the header's MEASURED height before flipping the class:
        // .mobile-header has no fixed height (it's content-sized, and grows
        // with safe-area-inset-top in PWA/standalone), so the CSS offset that
        // keeps "Back to cameras" clear of the floating header can't hardcode
        // a number. Measured while the header is still in flow.
        this.syncHeaderHeight();
        panel.classList.toggle('map-expanded', expanded);
        document.body.classList.toggle('live-map-active', expanded);
        if (button) button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        if (label) {
            label.textContent = expanded
                ? BYD.i18n.t('liveview.back_to_cameras')
                : BYD.i18n.t('liveview.expand_map');
        }

        // Leaflet keeps the preview's old dimensions until explicitly
        // invalidated after the expansion transition.
        setTimeout(function () {
            if (BYD.map && BYD.map.map) BYD.map.map.invalidateSize();
        }, 220);
    },
    toggleMap: function () {
        this.setMapExpanded(!this.mapExpanded);
    },
    /** Mirror the mobile header's real height into --live-mobile-header-h.
     *  No-op above 768px (the header is display:none there and the expanded
     *  card correctly starts at the panel's top edge). */
    syncHeaderHeight: function () {
        try {
            var hdr = document.querySelector('.mobile-header');
            if (!hdr) return;
            var h = Math.round(hdr.getBoundingClientRect().height);
            // A floating (already-expanded) header still reports its height,
            // but 0 means display:none — desktop, where no offset applies.
            document.documentElement.style.setProperty(
                '--live-mobile-header-h', (h > 0 ? h : 0) + 'px');
        } catch (e) { /* keep the CSS fallback */ }
    }
};

// Compatibility for any existing callers while the page moves away
// from ambiguous tab swapping. Cameras remain the default and map is
// promoted only by the explicitly labelled Expand map action.
BYD.tabs = {
    activeTab: 'cameras',
    switchTo: function (tab) {
        BYD.liveLayout.setMapExpanded(tab === 'map');
        this.activeTab = tab === 'map' ? 'map' : 'cameras';
    }
};

// Camera-first entry: ALL is selected before the stream starts.
BYD.stream.currentViewMode = 0;

BYD.stream.selectCamera = async function(mode) {
    // Invalidate every older route response, including a DVR
    // first-frame poll. A newer non-DVR click must always win.
    const selectionToken = (this._viewSelectionToken || 0) + 1;
    this._viewSelectionToken = selectionToken;
    this._viewPollToken = (this._viewPollToken || 0) + 1;
    const selectionIsCurrent = () => this._viewSelectionToken === selectionToken;

    // Capture the prior view mode + label BEFORE we mutate UI so the
    // already-streaming branch can preserve them while the backend
    // confirms the requested route.
    const priorMode = this.confirmedViewMode >= 0
        ? this.confirmedViewMode
        : this.currentViewMode;
    const priorLabelEl0 = document.getElementById('currentCameraLabel');
    const priorLabelText = priorLabelEl0 ? priorLabelEl0.textContent : '';
    const priorOverlayEl0 = document.getElementById('cameraLabelOverlay');
    const priorOverlayDisplay = priorOverlayEl0 ? priorOverlayEl0.style.display : '';

    // Toggle behavior: if the same camera is tapped again, stop the
    // stream. The earlier guard only checked sotaPlayer (WebCodecs),
    // so on the BYD in-app WebView (Chrome 58, no VideoDecoder) the
    // active player is jmuxer / Broadway / hw_player and the toggle
    // never fired — re-tapping the same camera silently re-started
    // the stream. Treat ANY active player + streamStarted as "live".
    const sotaLive = this.sotaPlayer && this.sotaPlayer.isRunning && this.sotaPlayer.isRunning();
    const legacyLive = this.streamStarted && (
        !!this.jmuxer || !!this.broadwayPlayer ||
        (this.ws && this.ws.readyState === WebSocket.OPEN)
    );
    const hadLiveStream = !!(sotaLive || legacyLive);
    if (this.currentViewMode === mode
            && (sotaLive || legacyLive || this.streamStarted)) {
        console.log("[Stream] Toggling off camera:", mode);
        // Reuse the canonical stopStream path so all decoder branches
        // (sota / jmuxer / broadway / ws) tear down cleanly. The
        // standalone `sotaPlayer.stop()` left jmuxer + ws dangling
        // when the active decoder wasn't WebCodecs.
        this.stopStream();
        this.currentViewMode = -1;
        // Every selected view is persisted server-side. Queue the
        // disable behind any in-flight route so a late response cannot
        // resurrect this stopped stream on the next reconnect.
        this._requestStreamDisable(this._viewSelectionToken).catch(() => {});

        // Remove active state from hotspots
        document.querySelectorAll('.cam-hotspot').forEach(el => el.classList.remove('active'));

        // Update UI
        const labelEl = document.getElementById('currentCameraLabel');
        const overlayEl = document.getElementById('cameraLabelOverlay');
        if (labelEl) labelEl.textContent = BYD.i18n.t('pip.select_camera');
        if (overlayEl) overlayEl.style.display = 'none';

        this.setStagePhase('idle');
        this.updateConnectionStatus('idle');
        return;
    }

    const camKeys = {0: 'pip.title_all_cameras', 1: 'pip.title_front_camera', 2: 'pip.title_right_camera', 3: 'pip.title_rear_camera', 4: 'pip.title_left_camera', 6: 'pip.title_oem_dashcam'};
    const labelEl = document.getElementById('currentCameraLabel');
    const overlayEl = document.getElementById('cameraLabelOverlay');

    // Keep the confirmed label and hotspot visible while a DVR route
    // waits for its first frame. Committing these optimistically made
    // AVM frames look like a mislabeled DVR feed.
    const commitSelectionUi = (selectedMode) => {
        document.querySelectorAll('.cam-hotspot').forEach(el => {
            el.classList.toggle('active', parseInt(el.dataset.cam) === selectedMode);
        });
        if (labelEl) {
            labelEl.textContent = camKeys[selectedMode]
                ? BYD.i18n.t(camKeys[selectedMode])
                : BYD.i18n.t('pip.default_camera');
        }
        if (overlayEl) overlayEl.style.display = 'block';
    };
    const restorePriorUi = () => {
        document.querySelectorAll('.cam-hotspot').forEach(el => {
            el.classList.toggle('active', parseInt(el.dataset.cam) === priorMode);
        });
        if (labelEl) labelEl.textContent = priorLabelText;
        if (overlayEl) overlayEl.style.display = priorOverlayDisplay;
    };
    const restorePriorRoute = () => {
        if (!selectionIsCurrent()) return;
        if (hadLiveStream && priorMode >= 0) {
            this._requestViewRoute(priorMode, selectionToken).catch(() => {});
        } else {
            this._requestStreamDisable(selectionToken).catch(() => {});
        }
    };
    const reassertLatestRoute = () => {
        const latestMode = this.currentViewMode;
        if (latestMode >= 0) {
            this._requestViewRoute(
                latestMode, this._viewSelectionToken).catch(() => {});
        } else {
            this._requestStreamDisable(this._viewSelectionToken).catch(() => {});
        }
    };

    this.currentViewMode = mode;

    // Helper: switch view mode + revert UI on backend rejection. The
    // backend returns {success:false, error} when the requested
    // mode isn't currently routable (e.g. view 6 = OEM Dashcam
    // before the streaming hook is plumbed). Without the JSON
    // parse, the hotspot ring stays "active" while WS frames keep
    // arriving from the previous source.
    const applyView = async (m) => {
        try {
            if (!selectionIsCurrent()) {
                reassertLatestRoute();
                return { cancelled: true };
            }
            let d = await BYD.stream._requestViewRoute(m, selectionToken);
            if (!selectionIsCurrent()) {
                reassertLatestRoute();
                return { cancelled: true };
            }
            if (d && d.success === false && d.starting) {
                d = await BYD.stream._pollViewUntilSettled(m, d, selectionToken);
            }
            // Cancelled by a newer click — treat as success-ish
            // (don't toast an error, don't revert the UI). The
            // newer click is responsible for its own UI state.
            if (d && d.cancelled) return d;
            if (d && d.success === false) {
                if (BYD.utils && BYD.utils.toast) {
                    // An exhausted poll still reports the sticky
                    // `*_starting` code, which would announce progress
                    // as the failure. The timeout is the outcome.
                    BYD.utils.toast(d.exhausted
                        ? BYD.i18n.t('stream.start_failed')
                        : (d.errorCode
                            ? BYD.i18n.t('stream.' + d.errorCode)
                            : (d.error || BYD.i18n.t('stream.view_unavailable'))),
                        'error');
                }
                return false;
            }
            return true;
        } catch (e) {
            if (!selectionIsCurrent()) {
                reassertLatestRoute();
                return { cancelled: true };
            }
            if (BYD.utils && BYD.utils.toast) {
                BYD.utils.toast(BYD.i18n.t('stream.view_unavailable'), 'error');
            }
            return false;
        }
    };

    // If already streaming, just switch the view mode. Restore prior
    // UI state on rejection — leaving the user staring at "select
    // camera" while frames continue from the previous view is the
    // exact UX glitch the Round 3 audit flagged.
    if (sotaLive || legacyLive) {
        console.log("[Stream] Switching view to:", mode);
        const switchGen = this._startGeneration;
        const ok = await applyView(mode);
        // A stopStream() landed mid-switch (backgrounded / toggled off):
        // don't touch UI or confirmedViewMode for a stream that's gone.
        if (this._startGeneration !== switchGen) return;
        if (!selectionIsCurrent() || (ok && ok.cancelled)) return;
        if (ok === false) {
            restorePriorRoute();
            this.currentViewMode = priorMode;
            this.confirmedViewMode = priorMode;
            restorePriorUi();
        } else {
            this.confirmedViewMode = mode;
            commitSelectionUi(mode);
            // The BYD WebView fallback reuses its open WebSocket, so
            // switching cameras does not emit another onopen event.
            // Mark this transition pending; the first frame from the
            // newly-selected view promotes the badge back to Live.
            this.markStreamConnecting();
        }
        return;
    }

    const started = await this.startSeamlessStream(selectionToken);
    if (started && selectionIsCurrent()) {
        commitSelectionUi(mode);
    } else if (!started && selectionIsCurrent()) {
        restorePriorRoute();
    }
};

BYD.stream.startSeamlessStream = async function(selectionToken) {
    // A stopStream() during any await below (backgrounding, toggle-off)
    // supersedes this run; without the check it would still enable
    // streaming and build a decoder after the teardown.
    const gen = ++this._startGeneration;
    const superseded = () => this._startGeneration !== gen;
    const selectionIsCurrent = () => selectionToken === undefined
        || this._viewSelectionToken === selectionToken;
    const reassertLatestRoute = () => {
        const latestMode = this.currentViewMode;
        if (latestMode >= 0) {
            this._requestViewRoute(
                latestMode, this._viewSelectionToken).catch(() => {});
        } else {
            this._requestStreamDisable(this._viewSelectionToken).catch(() => {});
        }
    };
    this.streamStarted = true;

    this.setStagePhase('busy');
    this.markStreamConnecting();

    // 1. Set quality
    var _qSel = document.getElementById('qualitySelector');
    const quality = (_qSel && _qSel.value) || 'LOW';
    try {
        const qRes = await fetch('/api/stream/quality/' + quality, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const qData = await qRes.json();
        if (qData.fps) this.activeFps = qData.fps;
    } catch(e) {}
    if (superseded() || !selectionIsCurrent()) return false;

    // 2. Set view mode BEFORE enabling streaming. Bail if the
    // backend rejects the mode — otherwise WS connects to the
    // default sink and the UI shows a stale label over different
    // frames.
    if (this.currentViewMode >= 0) {
        try {
            let d = await BYD.stream._requestViewRoute(
                this.currentViewMode, selectionToken);
            if (!selectionIsCurrent()) {
                reassertLatestRoute();
                return false;
            }
            if (d && d.success === false && d.starting) {
                d = await BYD.stream._pollViewUntilSettled(
                    this.currentViewMode, d, selectionToken);
            }
            if (superseded() || !selectionIsCurrent()) {
                if (!selectionIsCurrent()) reassertLatestRoute();
                return false;
            }
            // Cancelled by a newer click; let the newer click own
            // the UI state. Don't bail out as if an error happened.
            if (d && d.cancelled) return false;
            if (d && d.success === false) {
                // An exhausted poll still carries the sticky `*_starting`
                // errorCode, so reporting that code here would announce
                // progress as the failure. The timeout is the outcome.
                const reason = d.exhausted
                    ? BYD.i18n.t('stream.start_failed')
                    : (d.errorCode
                        ? BYD.i18n.t('stream.' + d.errorCode)
                        : (d.error || BYD.i18n.t('stream.view_unavailable')));
                document.querySelectorAll('.cam-hotspot').forEach(el => el.classList.remove('active'));
                this.currentViewMode = -1;
                this.confirmedViewMode = -1;
                this.streamStarted = false;
                this.setStagePhase('error', reason);
                this.updateConnectionStatus('idle');
                return false;
            }
            this.confirmedViewMode = this.currentViewMode;
            console.log("[Stream] View mode set to:", this.currentViewMode);
        } catch(e) {
            if (superseded() || !selectionIsCurrent()) {
                if (!selectionIsCurrent()) reassertLatestRoute();
                return false;
            }
            this.currentViewMode = -1;
            this.confirmedViewMode = -1;
            this.streamStarted = false;
            this.setStagePhase('error', BYD.i18n.t('stream.view_unavailable'));
            this.updateConnectionStatus('idle');
            return false;
        }
    }

    // 3. Enable Streaming on Backend
    const enabled = await this.enableStreaming();
    if (superseded() || !selectionIsCurrent()) return false;
    if (!enabled) {
        this.streamStarted = false;
        this.setStagePhase('error', BYD.i18n.t('liveview.enable_failed'));
        this.updateConnectionStatus('idle');
        return false;
    }

    // 4. Initialize SOTA Player (WebCodecs)
    if ('VideoDecoder' in window && typeof SotaPlayer !== 'undefined') {
        console.log("[Stream] Initializing SOTA Player (WebCodecs)...");
        this.decoderMode = 'webcodecs';

        const canvas = document.getElementById('sota_canvas');
        if (canvas) {
            canvas.classList.add('active');
            var _hw = document.getElementById('hw_player');
            if (_hw) _hw.classList.remove('active');
            var _sw = document.getElementById('sw_container');
            if (_sw) _sw.classList.remove('active');
        }


        // CRITICAL FIX: Use the /ws endpoint on the current port (e.g. 8080)
        // Do NOT use port 8887 - that's the dead legacy port
        // Append JWT as ?token= so tunnels work (cookies get dropped by SameSite
        // policies through reverse proxies; browser WS API can't set headers).
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let url = `${protocol}//${window.location.host}/ws`;
        if (typeof BYDAuth !== 'undefined') {
            const wsToken = BYDAuth.getToken();
            if (wsToken) url += `?token=${encodeURIComponent(wsToken)}`;
        }
        console.log("[Stream] Connecting to optimized endpoint:", url);

        // Initialize and Start Player
        if (this.sotaPlayer) {
            this.sotaPlayer.stop();
        }

        // Store view mode for logging
        const targetViewMode = this.currentViewMode;

        this.sotaPlayer = new SotaPlayer(canvas, url);
        this.sotaPlayer.onConnected = () => {
            console.log("[Stream] Connected, view mode:", targetViewMode);
            this.markStreamConnecting();
        };
        this.sotaPlayer.onDisconnected = () => this.markStreamConnecting();
        this.sotaPlayer.onFrame = (count) => this.noteFrameReceived(count);
        // Unrecoverable WebCodecs failure → switch decoders. This page
        // wires its own player, so without this hook the shared
        // fallback in stream.js never ran and the canvas stayed black
        // on phones whose decoder rejects the stream's profile.
        this.sotaPlayer.onError = () => {
            if (BYD.utils && BYD.utils.toast) {
                BYD.utils.toast(BYD.i18n.t('liveview.decoder_fallback'), 'warning');
            }
            this.fallbackFromWebCodecs();
        };
        this.sotaPlayer.start();

    } else {
        // Fallback to Legacy (JMuxer/Broadway) if WebCodecs not supported
        console.log("[Stream] WebCodecs not supported, using fallback decoder...");
        const decoderReady = await this.initDecoder();
        if (!decoderReady) {
            if (BYD.utils && BYD.utils.toast) BYD.utils.toast('Decoder init failed', 'error');
            this.streamStarted = false;
            return false;
        }
        if (superseded() || !selectionIsCurrent()) return false;

        // Show appropriate video element based on decoder mode
        if (this.decoderMode === 'jmuxer') {
            const video = document.getElementById('hw_player');
            if (video) video.classList.add('active');
        } else {
            const container = document.getElementById('sw_container');
            if (container) container.classList.add('active');
        }

        this.connectWebSocket();
    }
    return true;
};

/**
 * Drives the centred overlay on the video stage: 'idle', 'busy',
 * 'error', or 'live' (hidden). Call only on selection and terminal
 * outcomes — a mid-stream reconnect must not drop this overlay back
 * over a frozen frame.
 */
BYD.stream.setStagePhase = function(phase, message) {
    const stage = document.getElementById('videoIdleState');
    if (!stage) return;
    const textEl = stage.querySelector('.idle-text');
    const subEl = stage.querySelector('.idle-subtext');
    if (phase === 'live') {
        stage.classList.add('hidden');
        stage.classList.remove('is-busy');
        stage.classList.remove('is-error');
        return;
    }
    stage.classList.remove('hidden');
    stage.classList.remove('is-busy');
    stage.classList.remove('is-error');
    if (phase === 'busy') {
        stage.classList.add('is-busy');
        if (textEl) textEl.textContent = message || BYD.i18n.t('pip.connecting');
    } else if (phase === 'error') {
        stage.classList.add('is-error');
        if (textEl) {
            textEl.textContent = message || BYD.i18n.t('stream.start_failed');
        }
        if (subEl) subEl.textContent = BYD.i18n.t('stream.idle_hint');
    } else if (textEl) {
        textEl.textContent = BYD.i18n.t('stream.idle_hint');
    }
};

/**
 * Sink for the backend's start-up reason (oem_starting / pano_starting).
 * Its presence makes shared stream.js skip its own toast, so the more
 * specific message replaces the generic spinner text in place.
 */
BYD.stream.showStartupStatus = function(message) {
    const stage = document.getElementById('videoIdleState');
    if (!stage || stage.classList.contains('hidden')) return;
    this.setStagePhase('busy', message);
};

BYD.stream.updateConnectionStatus = function(status) {
    const el = document.getElementById('connectionStatus');
    if (el) {
        el.classList.remove('live', 'connecting', 'disconnected');
        let labelKey = 'pip.select_camera';
        if (status === 'live') {
            el.classList.add('live');
            labelKey = 'liveview.live';
        } else if (status === 'connecting') {
            el.classList.add('connecting');
            labelKey = 'pip.connecting';
        } else if (status === 'disconnected') {
            el.classList.add('disconnected');
            labelKey = 'stream.disconnected';
        }
        el.setAttribute('aria-label', BYD.i18n.t(labelKey));
    }
    if (status === 'live') this.setStagePhase('live');
};

const originalUpdateStatus = BYD.stream.updateStreamStatus;
BYD.stream.updateStreamStatus = function(text, isLive) {
    this.updateConnectionStatus(isLive ? 'live' : 'connecting');
    if (originalUpdateStatus) originalUpdateStatus.call(this, text, isLive);
};

// Manual deterrent trigger (issue #118). `kind` is 'horn' or 'flash':
//   horn  → POST /api/vehicle/find-car  (FINDCAR = horn + lights; the
//           only horn primitive exposed on this BYD generation — there
//           is no lights-independent horn command).
//   flash → POST /api/vehicle/flash     (FLASHLIGHT = lights only).
// Both are cloud-only, so the cluster is only visible after the cloud
// probe unhides it. Each fire is gated behind a themed confirm dialog
// (BYD.utils.confirmDialog) to prevent an accidental horn blast, then
// the button enters a pending state until the routed response lands so
// a double-tap can't queue two commands. The toast reads the
// server-resolved `message` (correct locale + which transport fired),
// falling back to a local string only when the endpoint returns none.
BYD.stream.fireDeterrent = async function(kind) {
    const isHorn = kind === 'horn';
    const btnId = isHorn ? 'deterrentHornBtn' : 'deterrentFlashBtn';
    const btn = document.getElementById(btnId);
    if (btn && btn.classList.contains('pending')) return;

    const confirmed = await BYD.utils.confirmDialog({
        title: isHorn ? BYD.i18n.t('liveview.deterrent_horn_confirm_title')
                      : BYD.i18n.t('liveview.deterrent_flash_confirm_title'),
        body: isHorn ? BYD.i18n.t('liveview.deterrent_horn_confirm_body')
                     : BYD.i18n.t('liveview.deterrent_flash_confirm_body'),
        confirmLabel: BYD.i18n.t('liveview.deterrent_confirm_ok'),
        cancelLabel: BYD.i18n.t('common.cancel'),
        danger: isHorn
    });
    if (!confirmed) return;

    if (btn) btn.classList.add('pending');
    const endpoint = isHorn ? '/api/vehicle/find-car' : '/api/vehicle/flash';
    let result;
    try {
        // fetch() (not XHR) — POST bodies are dropped by the BYD WebView's
        // XHR path; fetch is the reliable transport here.
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
        });
        result = await resp.json();
    } catch (e) {
        result = { success: false };
    } finally {
        if (btn) btn.classList.remove('pending');
    }

    if (BYD.utils && BYD.utils.toast) {
        const fallbackOk = isHorn ? BYD.i18n.t('liveview.deterrent_horn_sent')
                                  : BYD.i18n.t('liveview.deterrent_flash_sent');
        const fallbackErr = BYD.i18n.t('liveview.deterrent_failed');
        const msg = (result && result.message)
            || (result && result.success ? fallbackOk : ((result && result.error) || fallbackErr));
        const type = (result && result.success) ? 'success'
            : (result && (result.outcome === 'auth_required' || result.outcome === 'rate_limited')) ? 'info'
            : 'error';
        BYD.utils.toast(msg, type);
    }
};

// Door lock / unlock from the live view. Same endpoints and routing as
// the dashboard Quick controls and Vehicle Control page:
//   POST /api/vehicle/lock | /api/vehicle/unlock
// (SDK_FIRST on the local rail, BYD Cloud as the confirmed fallback).
// Unlock is gated behind a themed confirm dialog so a stray tap on a
// live feed can't open the car; lock fires immediately. The pressed
// button shows the pending state, and both buttons are blocked while a
// request is in flight so lock + unlock can't race each other.
BYD.stream.fireDoorLock = async function(kind) {
    const isUnlock = kind === 'unlock';
    const lockBtn = document.getElementById('vehicleLockBtn');
    const unlockBtn = document.getElementById('vehicleUnlockBtn');
    const btn = isUnlock ? unlockBtn : lockBtn;
    if ((lockBtn && lockBtn.classList.contains('pending')) ||
        (unlockBtn && unlockBtn.classList.contains('pending'))) return;

    if (isUnlock) {
        const confirmed = await BYD.utils.confirmDialog({
            title: BYD.i18n.t('liveview.unlock_confirm_title'),
            body: BYD.i18n.t('liveview.unlock_confirm_body'),
            confirmLabel: BYD.i18n.t('dashboard.cmd_unlock'),
            cancelLabel: BYD.i18n.t('common.cancel'),
            danger: true
        });
        if (!confirmed) return;
    }

    if (lockBtn) lockBtn.classList.add('pending');
    if (unlockBtn) unlockBtn.classList.add('pending');
    if (btn) btn.setAttribute('aria-busy', 'true');
    let result;
    try {
        // fetch() (not XHR) — POST bodies are dropped by the BYD WebView's XHR path.
        const resp = await fetch(isUnlock ? '/api/vehicle/unlock' : '/api/vehicle/lock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
        });
        result = await resp.json();
    } catch (e) {
        result = { success: false };
    } finally {
        if (lockBtn) lockBtn.classList.remove('pending');
        if (unlockBtn) unlockBtn.classList.remove('pending');
        if (btn) btn.removeAttribute('aria-busy');
    }

    if (BYD.utils && BYD.utils.toast) {
        const fallbackOk = isUnlock ? BYD.i18n.t('vehicle.car_unlocked')
                                    : BYD.i18n.t('vehicle.car_locked');
        const fallbackErr = isUnlock ? BYD.i18n.t('vehicle.unlock_failed')
                                     : BYD.i18n.t('vehicle.lock_failed');
        const msg = (result && result.message)
            || (result && result.success ? fallbackOk : ((result && result.error) || fallbackErr));
        const type = (result && result.success) ? 'success'
            : (result && (result.outcome === 'auth_required' || result.outcome === 'rate_limited')) ? 'info'
            : 'error';
        BYD.utils.toast(msg, type);
    }
};

BYD.stream.closeVehicleActions = function() {
    const panel = document.getElementById('deterrentControls');
    const trigger = document.getElementById('vehicleActionsTrigger');
    if (panel) panel.style.display = 'none';
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
};
BYD.stream.toggleVehicleActions = function() {
    const panel = document.getElementById('deterrentControls');
    const trigger = document.getElementById('vehicleActionsTrigger');
    if (!panel || !trigger) return;
    if (panel.style.display !== 'none') { this.closeVehicleActions(); return; }
    panel.style.display = 'flex';
    trigger.setAttribute('aria-expanded', 'true');
    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    const up = below < 180 && above > below;
    panel.style.maxHeight = Math.max(64, Math.min(440, (up ? above : below) - 8)) + 'px';
    const width = panel.offsetWidth;
    const anchorX = document.documentElement.dir === 'rtl' ? rect.left : rect.right - width;
    panel.style.left = Math.max(8, Math.min(anchorX, window.innerWidth - width - 8)) + 'px';
    panel.style.top = Math.max(8, up ? rect.top - panel.offsetHeight - 6 : rect.bottom + 6) + 'px';
};
document.addEventListener('click', function(event) {
    const panel = document.getElementById('deterrentControls');
    const trigger = document.getElementById('vehicleActionsTrigger');
    if (panel && panel.style.display !== 'none' &&
        !(panel.contains(event.target) || (trigger && trigger.contains(event.target)))) {
        BYD.stream.closeVehicleActions();
    }
});
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const trigger = document.getElementById('vehicleActionsTrigger');
        if (trigger && trigger.getAttribute('aria-expanded') === 'true') {
            BYD.stream.closeVehicleActions();
            trigger.focus();
        }
    }
});
window.addEventListener('resize', function() { BYD.stream.closeVehicleActions(); });

// Serialize all Actions selections, including their confirmation dialogs.
// Keep #425's fireDoorLock and #118's fireDeterrent implementations.
BYD.stream.fireLiveAction = async function(kind) {
    if (this.liveActionBusy) return;
    this.closeVehicleActions();
    this.liveActionBusy = true;
    try {
        if (kind === 'lock' || kind === 'unlock') await this.fireDoorLock(kind);
        else if (kind === 'horn' || kind === 'flash') await this.fireDeterrent(kind);
        else await this.fireLiveVehicleCommand(kind);
    } catch (e) {
        if (BYD.utils && BYD.utils.toast) BYD.utils.toast(BYD.i18n.t('dashboard.toast_command_failed'), 'error');
    } finally {
        this.liveActionBusy = false;
    }
};
BYD.stream.fireLiveVehicleCommand = async function(kind) {
    const commands = {
        powerOn: { id: 'vehiclePowerOnBtn', path: '/api/vehicle/power-on',
            label: 'vehicle.power_on', title: 'vehicle.power_on_confirm', body: 'vehicle.power_on_confirm_body' },
        powerOff: { id: 'vehiclePowerOffBtn', path: '/api/vehicle/power-off',
            label: 'vehicle.power_off', title: 'vehicle.power_off_confirm', body: 'vehicle.power_off_confirm_body', danger: true },
        trunkOpen: { id: 'vehicleTrunkOpenBtn', path: '/api/vehicle/trunk', payload: { action: 'open' },
            label: 'dashboard.cmd_trunk_open', title: 'liveview.trunk_open_confirm_title', body: 'liveview.trunk_open_confirm_body' },
        trunkClose: { id: 'vehicleTrunkCloseBtn', path: '/api/vehicle/trunk', payload: { action: 'close' },
            label: 'dashboard.cmd_trunk_close', title: 'liveview.trunk_close_confirm_title', body: 'liveview.trunk_close_confirm_body', danger: true }
    };
    const command = commands[kind];
    if (!command) return;
    const btn = document.getElementById(command.id);
    if (!btn || btn.style.display === 'none') return;
    const confirmed = await BYD.utils.confirmDialog({
        title: BYD.i18n.t(command.title), body: BYD.i18n.t(command.body),
        confirmLabel: BYD.i18n.t(command.label), cancelLabel: BYD.i18n.t('common.cancel'),
        danger: !!command.danger
    });
    if (!confirmed) return;
    btn.classList.add('pending');
    btn.setAttribute('aria-busy', 'true');
    let result;
    try {
        const resp = await fetch(command.path, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: command.payload ? JSON.stringify(command.payload) : undefined
        });
        result = await resp.json();
    } catch (e) {
        result = { success: false };
    } finally {
        btn.classList.remove('pending');
        btn.removeAttribute('aria-busy');
    }
    if (BYD.utils && BYD.utils.toast) {
        const ok = !!(result && result.success);
        const fallback = BYD.i18n.t(ok ? 'dashboard.toast_command_sent' : 'dashboard.toast_command_failed');
        const msg = (result && (result.message || result.error)) || fallback;
        const type = ok ? 'success' : (result &&
            (result.outcome === 'auth_required' || result.outcome === 'rate_limited')) ? 'info' : 'error';
        BYD.utils.toast(msg, type);
    }
};

BYD.stream.toggleFullscreen = function() {
    this.closeVehicleActions();
    const view = document.querySelector('.seamless-camera-view');
    if (!view) return;
    this.isFullscreen = !this.isFullscreen;
    view.classList.toggle('fullscreen', this.isFullscreen);
    if (this.isFullscreen && view.requestFullscreen) {
        view.requestFullscreen().catch(() => {});
    } else if (!this.isFullscreen && document.fullscreenElement) {
        document.exitFullscreen();
    }
};

async function loadSavedStreamQuality() {
    try {
        const res = await fetch('/api/stream/quality');
        const data = await res.json();
        if (data.success && data.current) {
            const select = document.getElementById('qualitySelector');
            if (select) {
                select.value = data.current;
                BYD.stream.selectedQuality = data.current;
                if (BYD.qualityMenu) BYD.qualityMenu.sync();
            }
            const preset = (data.options || []).find(
                option => option.id === data.current);
            if (preset && preset.fps) {
                BYD.stream.activeFps = preset.fps;
            }
        }
    } catch (e) {
        console.log('[Init] Using default quality');
    } finally {
        // The HTML default is only a placeholder. Reveal the control
        // after the saved-quality request settles, even on failure.
        const menu = document.getElementById('qualityMenu');
        if (menu) {
            menu.classList.remove('is-loading');
            menu.removeAttribute('aria-busy');
        }
    }
}

// i18n must load before first paint. Once the shared modules and the
// saved quality are ready, start the useful view immediately instead
// of presenting an empty "select camera" state.
BYD.i18n.init().then(async function () {
    BYD.core.init();
    BYD.cabinListener.init();
    BYD.stream.init();
    BYD.map.init();
    SurvSettings.initHeatmapOnly();
    await loadSavedStreamQuality();
    BYD.qualityMenu.init();
    if (!BYD.stream.autoStartRequested) {
        BYD.stream.autoStartRequested = true;
        await BYD.stream.selectCamera(0);
    }
});

// Gate the OEM Dashcam (data-cam=6) hotspot on whether the
// backend has a configured OEM dashcam camera id for this
// vehicle. /api/settings/quality returns:
//   oemDashcam: { oemDashcamCameraId, concurrentAvmSupported, ... }
// Negative id (-1) = unset / not detected — keep the hotspot
// hidden so the user can't tap into a view that the backend
// will reject. One-shot fetch on page load: the user reloads
// the live-view tab after configuring the id, so a perpetual
// poll would just burn cycles.
(async function () {
    try {
        const res = await fetch('/api/settings/quality');
        const data = await res.json();
        const oem = data && data.oemDashcam;
        const camId = oem && typeof oem.oemDashcamCameraId === 'number'
            ? oem.oemDashcamCameraId
            : -1;
        const hotspot = document.querySelector('.cam-hotspot[data-cam="6"]');
        if (hotspot) {
            hotspot.style.display = camId >= 0 ? '' : 'none';
        }
    } catch (e) {
        // Backend unreachable or response shape changed — leave
        // the hotspot hidden (its inline default). The feature
        // is opt-in; silent suppression is the safe fallback.
        console.log('[Init] OEM dashcam gating skipped:', e && e.message);
    }
})();

// Gate the car controls on a path to the car: Horn / Flash (issue #118) on
// BYD Cloud, Lock / Unlock on cloud or the local remote key. Hiding a row
// until the probe confirms its path keeps the camera view honest: a
// visible button always works.
// One-shot probe on load, mirroring the OEM-dashcam gate below (the
// user re-enters the live view after configuring cloud, so a
// perpetual poll would just burn cycles). Cluster defaults to
// display:none inline, so any failure path leaves it safely hidden.
(async function () {
    try {
        const res = await fetch('/api/vehicle/cloud-status');
        const data = await res.json();
        const cloudReady = !!(data && data.configured && data.verified);
        // Lock / unlock also work on the local remote-key rail with no
        // cloud account; horn + flash stay cloud-only.
        const localKey = !!(data && data.localRemoteKey);
        const lockRow = document.getElementById('vehicleLockRow');
        const horn = document.getElementById('deterrentHornBtn');
        const flash = document.getElementById('deterrentFlashBtn');
        if (lockRow && (cloudReady || localKey)) lockRow.style.display = '';
        if (horn && cloudReady) horn.style.display = '';
        if (flash && cloudReady) flash.style.display = '';
        // The menu must stay closed until Actions is explicitly clicked.
        const powerOn = document.getElementById('vehiclePowerOnBtn');
        const powerOff = document.getElementById('vehiclePowerOffBtn');
        if (powerOn && localKey) powerOn.style.display = '';
        if (powerOff && localKey) powerOff.style.display = '';
    } catch (e) {
        // Cloud status unreachable — leave the cluster hidden (its
        // inline default). Deterrent controls are opt-in on cloud
        // availability; silent suppression is the safe fallback.
        console.log('[Init] Deterrent controls gating skipped:', e && e.message);
    }
})();

// Draggable mini-preview chip with snap-to-corner.
//
// Pattern: AssistiveTouch / Google Translate floating bubble.
// Pointer down starts a drag; the chip tracks the pointer freely
// (top/left set per-frame, no transition). On release we measure
// the chip centre vs the four corners of its containing rail and
// animate to the nearest one. Position persists in localStorage
// (corner only, so the chip lands correctly on next load even if
// viewport size changes) and we treat any pointer move under
// ~5px as a click — that keeps the existing tab-toggle behaviour
// intact for users who never want to drag.
(function () {
    var chip = document.getElementById('miniPreview');
    if (!chip) return;
    var rail = chip.parentElement;     // .live-tabs-view (positioned)
    var STORAGE_KEY = 'liveview.miniPreviewCorner';
    var MARGIN = 16;                   // distance from rail edge after snap
    var DRAG_THRESHOLD = 5;            // px before we treat as drag, not click

    // Compute the actual top/bottom safe zones at apply-time. Static
    // constants didn't work because:
    //   - TOP_RESERVED=80 was just barely below the .camera-top-bar
    //     overlay (connection pill + quality select), so the chip
    //     visually sat under the bar's drop shadow when snapped tl/tr.
    //   - BOTTOM_RESERVED=16+60 ignored the camera tab's
    //     .car-selector-bottom, a ~200px-tall bottom widget. Snapping
    //     bl/br on the map tab worked, but switching to the camera
    //     tab put the chip behind the car selector.
    //
    // Strategy: measure the actual obstructing element rectangles
    // relative to the rail. Top guard = bottom edge of the camera
    // top-bar (or 0 on map tab where no overlay exists). Bottom
    // guard = top edge of the car-selector-bottom (or rail bottom
    // on map tab). 12px breathing room on each side so the chip
    // sits below/above the obstruction with a visible gap.
    function obstructionRect(selector) {
        var el = document.querySelector(selector);
        if (!el) return null;
        // Skip elements with display:none (inactive tab panel).
        if (el.offsetWidth === 0 && el.offsetHeight === 0) return null;
        var elR = el.getBoundingClientRect();
        var railR = rail.getBoundingClientRect();
        return {
            top: elR.top - railR.top,
            bottom: elR.bottom - railR.top,
            height: elR.height,
        };
    }
    function computeSafeZone() {
        var BREATH = 12;
        var railH = rail.getBoundingClientRect().height;
        var chipH = chip.offsetHeight || 80;
        // Top: take the MAX of every obstruction that overlaps the
        // top region of the rail.
        //   - .mobile-header on the map tab: position:absolute
        //     floats over the map at < 768px, so its bottom edge
        //     pokes INTO the rail's coordinate space — chip
        //     would slide under it without this.
        //   - .camera-top-bar: position:absolute inside the
        //     camera panel, ~70-80px tall.
        //   - The .map-overlay-actions FAB cluster (top-right):
        //     a chip in the top-RIGHT would collide with My
        //     Location / Directions buttons, so we also clear
        //     past the bottom of that cluster on the map tab.
        var topGuard = MARGIN;
        var candidates = [
            obstructionRect('.mobile-header'),
            obstructionRect('.tab-panel.active .camera-top-bar'),
            obstructionRect('.tab-panel.active .map-overlay-actions'),
        ];
        for (var i = 0; i < candidates.length; i++) {
            var c = candidates[i];
            if (c && c.bottom > 0 && c.bottom + BREATH > topGuard) {
                topGuard = c.bottom + BREATH;
            }
        }
        // Bottom: car-selector-bottom only exists on the camera panel;
        // otherwise fall back to the safe-bottom inset.
        var bottomGuard = MARGIN;
        var obstr = obstructionRect('.tab-panel.active .car-selector-bottom');
        if (obstr && obstr.top > 0 && obstr.top < railH) {
            // Distance from rail bottom up to the top edge of the
            // obstruction. Only honour rects that are actually
            // BELOW the rail top (top > 0) and INSIDE the rail
            // (top < railH) — defends against measurement glitches
            // when an inactive panel's children are briefly read
            // through getBoundingClientRect right after a tab
            // swap (Chrome desktop sometimes returns rects from
            // a stale layout before the next paint commits).
            bottomGuard = (railH - obstr.top) + BREATH;
        }
        // Clamp so the chip ALWAYS has at least a chipH+8px usable
        // band between top and bottom guards. If both guards are
        // huge (rail unusually short or stale measurements), the
        // chip would otherwise be positioned with bottom > railH-
        // chipH which puts its top above 0 — invisible. Reserve
        // room by capping each guard at 40% of the rail.
        var maxGuard = Math.max(MARGIN, railH * 0.4 - chipH);
        if (topGuard > maxGuard) topGuard = maxGuard;
        if (bottomGuard > maxGuard) bottomGuard = maxGuard;
        return { top: topGuard, bottom: bottomGuard };
    }

    // Map a corner key to the four position properties. We set all
    // four explicitly (auto for the unused pair) so the stylesheet's
    // `top: 80px; left: 24px` defaults don't fight our snap-target
    // when we land on bottom-right etc.
    function applyCorner(corner, animate) {
        if (animate) {
            chip.classList.add('snap-anim');
            setTimeout(function () { chip.classList.remove('snap-anim'); }, 260);
        }
        var safe = computeSafeZone();
        var topRes = safe.top + 'px';
        var leftRes = MARGIN + 'px';
        var rightRes = MARGIN + 'px';
        var bottomRes = safe.bottom + 'px';
        if (corner === 'tl') {
            chip.style.top = topRes; chip.style.left = leftRes;
            chip.style.right = 'auto'; chip.style.bottom = 'auto';
        } else if (corner === 'tr') {
            chip.style.top = topRes; chip.style.right = rightRes;
            chip.style.left = 'auto'; chip.style.bottom = 'auto';
        } else if (corner === 'bl') {
            chip.style.bottom = bottomRes; chip.style.left = leftRes;
            chip.style.top = 'auto'; chip.style.right = 'auto';
        } else {
            chip.style.bottom = bottomRes; chip.style.right = rightRes;
            chip.style.top = 'auto'; chip.style.left = 'auto';
        }
    }
    // Expose for the tab-switch listener installed below.
    chip._reapplyCorner = function () {
        var saved = 'bl';
        try {
            var s = localStorage.getItem(STORAGE_KEY);
            if (s && /^(tl|tr|bl|br)$/.test(s)) saved = s;
        } catch (e) {}
        applyCorner(saved, true);
    };

    // Restore last corner on first paint. Default to bottom-left so
    // the chip doesn't overlap the camera tab's top bar (connection
    // pill / decoder chip on the left, quality select / fullscreen
    // on the right) or the My Location / Directions FABs on the map
    // tab (top-right). User can drag to any corner.
    var savedCorner = 'bl';
    try {
        var s = localStorage.getItem(STORAGE_KEY);
        if (s && /^(tl|tr|bl|br)$/.test(s)) savedCorner = s;
    } catch (e) { /* localStorage blocked — ignore */ }
    applyCorner(savedCorner, false);

    // Use Pointer Events when present (Chrome 55+, so the BYD
    // Chrome 58 WebView qualifies) and fall back to touch + mouse
    // events otherwise. Move/up handlers are bound to *document*
    // — not the chip — so the drag survives the pointer leaving
    // the chip's bounds even when setPointerCapture silently fails
    // on some embedded WebView builds.
    var startX = 0, startY = 0;
    var startLeft = 0, startTop = 0;
    var moved = false;
    var activeId = null;          // pointerId / touch identifier / null for mouse

    function pickCoords(ev) {
        if (ev.touches && ev.touches.length) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
        if (ev.changedTouches && ev.changedTouches.length) return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
        return { x: ev.clientX, y: ev.clientY };
    }

    function beginDrag(ev) {
        if (ev.button !== undefined && ev.button !== 0) return false;
        var coords = pickCoords(ev);
        if (coords.x === undefined) return false;
        var railRect = rail.getBoundingClientRect();
        var chipRect = chip.getBoundingClientRect();
        startX = coords.x;
        startY = coords.y;
        startLeft = chipRect.left - railRect.left;
        startTop = chipRect.top - railRect.top;
        moved = false;
        chip.style.top = startTop + 'px';
        chip.style.left = startLeft + 'px';
        chip.style.right = 'auto';
        chip.style.bottom = 'auto';
        chip.classList.remove('snap-anim');
        return true;
    }

    function moveDrag(ev) {
        var coords = pickCoords(ev);
        if (coords.x === undefined) return;
        var dx = coords.x - startX;
        var dy = coords.y - startY;
        if (!moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
        if (!moved) {
            moved = true;
            chip.classList.add('dragging');
        }
        // Stop the WebView from interpreting the drag as a scroll
        // / refresh-pull. touch-action:none on the chip handles
        // pointer/touch events that originate on it; the document-
        // level fallback below still needs the explicit prevent.
        if (ev.cancelable) ev.preventDefault();
        var railRect = rail.getBoundingClientRect();
        var chipW = chip.offsetWidth, chipH = chip.offsetHeight;
        var safe = computeSafeZone();
        var nextLeft = Math.max(MARGIN, Math.min(railRect.width - chipW - MARGIN, startLeft + dx));
        var nextTop = Math.max(safe.top, Math.min(railRect.height - chipH - safe.bottom, startTop + dy));
        chip.style.left = nextLeft + 'px';
        chip.style.top = nextTop + 'px';
    }

    function endDrag() {
        if (!moved) {
            // Tap without drag — beginDrag still mutated the
            // chip's inline styles to `top:Ypx; left:Xpx; right:
            // auto; bottom:auto` (so a real drag could track the
            // pointer). The synthetic click is about to fire
            // BYD.tabs.switchTo(), which will trigger
            // _reapplyCorner — but only after a setTimeout(0).
            // Between now and that timeout, the chip would
            // briefly render anchored top-left at the OLD
            // position. On desktop with a previous bottom-corner
            // anchor this looks like the chip "jumping" up to
            // a Y coordinate that, when combined with the
            // tab-swap CSS reflow, can fall outside the new
            // panel's viewport (the click handler removes
            // .live-map-active which un-floats the mobile-header
            // and pushes the rail down; chip's old absolute
            // position is now off-screen above the rail).
            // Restore the corner anchor immediately to bridge
            // the gap — _reapplyCorner will run next tick and
            // recompute against the new tab's safe zone.
            var saved = 'bl';
            try {
                var s0 = localStorage.getItem(STORAGE_KEY);
                if (s0 && /^(tl|tr|bl|br)$/.test(s0)) saved = s0;
            } catch (e) {}
            applyCorner(saved, false);
            return;
        }
        chip.classList.remove('dragging');
        var railRect = rail.getBoundingClientRect();
        var chipRect = chip.getBoundingClientRect();
        var cx = (chipRect.left + chipRect.right) / 2 - railRect.left;
        var cy = (chipRect.top + chipRect.bottom) / 2 - railRect.top;
        var corner = (cy < railRect.height / 2 ? 't' : 'b') + (cx < railRect.width / 2 ? 'l' : 'r');
        applyCorner(corner, true);
        try { localStorage.setItem(STORAGE_KEY, corner); } catch (e) {}
        // Swallow the synthetic click that fires after a drag so
        // we don't toggle tabs immediately after dropping.
        var swallow = function (e) { e.stopPropagation(); e.preventDefault(); };
        chip.addEventListener('click', swallow, true);
        setTimeout(function () { chip.removeEventListener('click', swallow, true); }, 0);
    }

    // Register touch + mouse + (optionally) pointer events in
    // PARALLEL. The previous if/PointerEvent/else design bet
    // everything on the pointer path, but BYD's Chrome 58 in-app
    // WebView exposes window.PointerEvent yet sometimes never
    // dispatches pointerdown on a touch-originated gesture
    // (it dispatches touchstart instead, and the browser-level
    // pointer-from-touch synthesis the spec describes is
    // incomplete in the embedded WebView). The unified approach:
    //   - touchstart owns drag if it fires first.
    //   - pointerdown owns drag if IT fires first (mouse on
    //     desktop / hybrid devices that send pointer-only).
    //   - mousedown is a third fallback for ancient WebViews
    //     where neither pointer nor touch events are reliable
    //     (and for desktop browsers with no touch hardware that
    //     still synthesise mouse events).
    // activeId tracks which input owns the gesture so the other
    // paths short-circuit, and endDrag clears it.
    chip.addEventListener('touchstart', function (ev) {
        if (activeId !== null || !ev.touches || !ev.touches.length) return;
        if (!beginDrag(ev)) return;
        activeId = 'touch:' + ev.touches[0].identifier;
    }, { passive: true });
    document.addEventListener('touchmove', function (ev) {
        if (activeId === null || activeId.indexOf('touch:') !== 0) return;
        moveDrag(ev);
    }, { passive: false });
    var tEnd = function () {
        if (activeId === null || activeId.indexOf('touch:') !== 0) return;
        endDrag();
        activeId = null;
    };
    document.addEventListener('touchend', tEnd);
    document.addEventListener('touchcancel', tEnd);

    if (window.PointerEvent) {
        chip.addEventListener('pointerdown', function (ev) {
            if (activeId !== null) return;
            // Skip touch-originated pointer events — the
            // touchstart path already owns those. Without this
            // skip, on Chrome that DOES synthesize pointer-from-
            // touch correctly, both paths would fire and
            // double-init the drag.
            if (ev.pointerType === 'touch') return;
            if (!beginDrag(ev)) return;
            activeId = 'pointer:' + ev.pointerId;
            try { chip.setPointerCapture(ev.pointerId); } catch (e) {}
        });
        document.addEventListener('pointermove', function (ev) {
            if (activeId !== 'pointer:' + ev.pointerId) return;
            moveDrag(ev);
        });
        var pUp = function (ev) {
            if (activeId !== 'pointer:' + ev.pointerId) return;
            try { chip.releasePointerCapture(ev.pointerId); } catch (e) {}
            endDrag();
            activeId = null;
        };
        document.addEventListener('pointerup', pUp);
        document.addEventListener('pointercancel', pUp);
    }

    // Mouse fallback — covers desktop and the rare WebView with
    // neither working pointer nor touch events. Skipped if a
    // touch or pointer drag is already in flight.
    chip.addEventListener('mousedown', function (ev) {
        if (activeId !== null) return;
        if (!beginDrag(ev)) return;
        activeId = 'mouse';
    });
    document.addEventListener('mousemove', function (ev) {
        if (activeId !== 'mouse') return;
        moveDrag(ev);
    });
    document.addEventListener('mouseup', function () {
        if (activeId !== 'mouse') return;
        endDrag();
        activeId = null;
    });

    // Re-snap on viewport resize (e.g. BYD landscape↔portrait
    // rotation) so a corner valid in one orientation is also
    // valid in the other.
    window.addEventListener('resize', function () {
        try {
            var s = localStorage.getItem(STORAGE_KEY);
            if (s && /^(tl|tr|bl|br)$/.test(s)) applyCorner(s, false);
        } catch (e) {}
    });
})();

// Keep --live-mobile-header-h honest across rotation and viewport changes:
// the offset that holds "Back to cameras" clear of the floating header is a
// measured value, and rotating while the map is already expanded would
// otherwise leave the portrait height applied in landscape (where the header
// is display:none and the offset must collapse to 0).
window.addEventListener('resize', function () {
    if (BYD.liveLayout) BYD.liveLayout.syncHeaderHeight();
});
// Also measure once at startup so the very first expand is correct even if
// the header's height differs from the CSS fallback (safe-area insets).
if (BYD.liveLayout) BYD.liveLayout.syncHeaderHeight();

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && BYD.stream.isFullscreen) {
        BYD.stream.isFullscreen = false;
        var _scv = document.querySelector('.seamless-camera-view');
        if (_scv) _scv.classList.remove('fullscreen');
    }
});

// Top-down 3D vehicle in the camera selector. Replaces the static
// car-icon.webp PNG with the user's actual GLB tinted in their
// chosen paint colour, kept in sync with the sidebar EV-card via
// OverdriveAppShell.mountVehicleCanvas. Hotspot CSS positions
// (FRONT/REAR/LEFT/RIGHT around a 72×150 silhouette) align with
// the auto-fit roof-down render.
function mountLiveCarCanvas() {
    const canvas = document.getElementById('liveCarCanvas');
    if (!canvas) return;
    const shell = window.OverdriveAppShell;
    if (!shell || typeof shell.mountVehicleCanvas !== 'function') return;
    const container = canvas.parentElement;
    shell.mountVehicleCanvas(canvas, {
        view: 'top',
        onReady: function () {
            if (container) container.classList.add('vehicle-render-ready');
        }
    });
}
// app-shell.js exposes mountVehicleCanvas after it renders the
// sidebar and dispatches `app-shell:ready`. Listen for that
// event AND check synchronously in case the shell already
// initialised (script-load order on cached pages can flip).
if (window.OverdriveAppShell && window.OverdriveAppShell.mountVehicleCanvas) {
    mountLiveCarCanvas();
} else {
    document.addEventListener('app-shell:ready', mountLiveCarCanvas);
}

// Security F9 step 4: the timeline link starts one minute back, so it is built here.
window.LiveViewPage = {
    openTimeline: function () {
        location.href = 'events.html?view=timeline&t=' + (new Date().getTime() - 60000);
    }
};
