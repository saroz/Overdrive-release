/* Moved out of local/about.html (security fix F9: no inline scripts). */
const VEHICLE_INFO_KEYS = [
    'firmware', 'dsp', 'mcu', 'android', 'securityPatch', 'headUnit'
];
let vehicleInfoData = null;
let vehicleInfoFailed = false;

function renderVehicleInfo() {
    const unavailable = tSafe('about.vehicle_unavailable', 'Unavailable');
    for (const key of VEHICLE_INFO_KEYS) {
        const node = document.querySelector('[data-vehicle-info="' + key + '"]');
        if (!node) continue;
        const value = vehicleInfoData && vehicleInfoData[key];
        node.textContent = value == null || String(value).trim() === ''
            ? unavailable : String(value);
    }
    const status = document.getElementById('vehicleInfoStatus');
    if (status) {
        status.textContent = vehicleInfoFailed
            ? tSafe('about.vehicle_load_failed', 'Vehicle information is unavailable right now.')
            : (vehicleInfoData ? '' : tSafe('about.vehicle_loading', 'Loading vehicle information…'));
    }
}

async function loadVehicleInfo() {
    try {
        const resp = await fetch('/api/about/vehicle-info', {
            credentials: 'same-origin', cache: 'no-store'
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        if (!data || data.success !== true) throw new Error('Invalid response');
        vehicleInfoData = data;
        vehicleInfoFailed = false;
    } catch (e) {
        console.warn('[About] vehicle information load failed:', e);
        vehicleInfoData = null;
        vehicleInfoFailed = true;
    }
    renderVehicleInfo();
}

// Avatar palette mirrors the native fragment so the same name gets the
// same colour across web and head-unit.
const AVATAR_PALETTE = [
    '#6366F1', '#EC4899', '#14B8A6', '#F59E0B',
    '#8B5CF6', '#06B6D4', '#EF4444', '#22C55E'
];

function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
}

function avatarColor(name) {
    return AVATAR_PALETTE[hashStr(name) % AVATAR_PALETTE.length];
}

// Dark or light initial, whichever reads at 4.5:1 on the avatar colour.
function avatarInk(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#fff';
    var n = parseInt(m[1], 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) {
        v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    var L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? '#10161A' : '#fff';
}

// Pick a reasonable initial. Letter/number first; otherwise the first
// codepoint (handles CJK, emoji surrogate pairs cleanly via Array.from).
function initial(name) {
    const m = name.match(/[A-Za-z0-9]/);
    if (m) return m[0].toUpperCase();
    const cp = Array.from(name)[0];
    return cp ? cp.toUpperCase() : '?';
}

// Build a single row as a real DOM element (avoids HTML-attribute
// injection on names containing quotes/angle brackets and lets us bind
// the avatar `error` handler programmatically).
// Medal order is also the display order — credits.json ships sorted
// gold → silver → bronze, so the list needs no client-side sort.
const MEDALS = ['diamond', 'platinum', 'gold', 'silver', 'bronze'];
const TIER_CLASS = {
    diamond: 'medal-diamond', platinum: 'medal-platinum',
    gold: 'medal-gold', silver: 'medal-silver', bronze: 'medal-bronze'
};

function buildRow(entry) {
    const name = (entry.name || '').toString();
    if (!name) return null;
    const gh = (entry.github || '').toString().trim();
    const tierClass = TIER_CLASS[String(entry.tier || '').toLowerCase()] || '';
    // Guard against a malformed count: must be a finite integer > 1.
    const rawCount = Number(entry.count);
    const count = Number.isFinite(rawCount) && rawCount > 1
        ? Math.floor(rawCount) : 0;

    const row = document.createElement(gh ? 'a' : 'div');
    row.className = 'credit-row';
    if (gh) {
        row.href = 'https://github.com/' + encodeURIComponent(gh);
        row.target = '_blank';
        row.rel = 'noopener noreferrer';
    }

    // Avatar: GitHub CDN for contributors, initial-circle for supporters
    // and as a graceful fallback when the CDN 404s / is offline.
    let avatar;
    if (gh) {
        avatar = document.createElement('img');
        avatar.className = 'credit-avatar';
        avatar.loading = 'lazy';
        avatar.alt = '';
        avatar.src = 'https://github.com/' + encodeURIComponent(gh) + '.png?size=72';
        avatar.addEventListener('error', () => {
            // Preserve the tier class — replaceWith drops the old node.
            const fb = makeFallbackAvatar(name);
            if (tierClass) fb.classList.add(tierClass);
            avatar.replaceWith(fb);
        }, { once: true });
    } else {
        avatar = makeFallbackAvatar(name);
    }
    if (tierClass) avatar.classList.add(tierClass);
    row.appendChild(avatar);

    // Name + optional tier label share a column so the label sits
    // directly under the name rather than pushing the row wider.
    const textWrap = document.createElement('span');
    textWrap.className = 'credit-text';
    const nameEl = document.createElement('span');
    nameEl.className = 'credit-name';
    nameEl.textContent = name;
    textWrap.appendChild(nameEl);
    row.appendChild(textWrap);

    // Medal pip + its name. The name is what makes the colour legible
    // to everyone, so the two always ship together.
    if (tierClass) {
        const medal = document.createElement('span');
        medal.className = 'credit-medal ' + tierClass;
        const pip = document.createElement('span');
        pip.className = 'credit-medal-pip';
        medal.appendChild(pip);
        const label = document.createElement('span');
        label.textContent = tierLabel(entry.tier);
        medal.appendChild(label);
        row.appendChild(medal);
    }

    if (count) {
        const badge = document.createElement('span');
        badge.className = 'credit-count';
        badge.textContent = '×' + count;
        // The glyph alone reads as "times N" to sighted users; spell it
        // out for screen readers.
        badge.setAttribute('aria-label', tSafe('about.support_count', 'Supported {n} times')
            .replace('{n}', String(count)));
        row.appendChild(badge);
    }

    if (gh) {
        // Chevron rendered via innerHTML — content is static, no user data.
        const chev = document.createElement('span');
        chev.innerHTML = '<svg class="credit-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
        row.appendChild(chev.firstChild);
    }
    return row;
}

// i18n lookup that survives the pre-hydration window: BYD.i18n.t()
// returns null until the catalog loads, so fall back to the English
// literal rather than rendering a raw key.
function tSafe(key, fallback) {
    const t = window.BYD && window.BYD.i18n && window.BYD.i18n.t
        ? window.BYD.i18n.t(key) : null;
    return t || fallback;
}

const TIER_FALLBACK = {
    diamond: 'Diamond', platinum: 'Platinum',
    gold: 'Gold', silver: 'Silver', bronze: 'Bronze'
};

function tierLabel(tier) {
    const k = String(tier || '').toLowerCase();
    if (!TIER_FALLBACK[k]) return '';
    return tSafe('about.tier_' + k, TIER_FALLBACK[k]);
}

function makeFallbackAvatar(name) {
    const span = document.createElement('span');
    span.className = 'credit-avatar';
    span.style.background = avatarColor(name);
    span.style.color = avatarInk(avatarColor(name));
    span.style.borderColor = 'transparent';
    span.textContent = initial(name);
    return span;
}

function renderList(container, entries, emptyKey) {
    container.replaceChildren();
    if (!entries || entries.length === 0) {
        const t = (window.BYD && window.BYD.i18n && window.BYD.i18n.t)
            ? window.BYD.i18n.t(emptyKey)
            : 'List populates as people pitch in.';
        const empty = document.createElement('div');
        empty.className = 'credits-empty';
        empty.textContent = t;
        container.appendChild(empty);
        return;
    }
    for (const entry of entries) {
        const row = buildRow(entry);
        if (row) container.appendChild(row);
    }
}

// Build the size/×N legend. Only shows the rows that actually occur in
// the data, so a list with no patrons doesn't advertise a patron tier.
function renderLegend(entries) {
    const host = document.getElementById('supportersLegend');
    if (!host) return;
    host.replaceChildren();
    const hasCount = entries.some(e => Number(e.count) > 1);
    const present = MEDALS.filter(m =>
        entries.some(e => String(e.tier || '').toLowerCase() === m));
    if (!present.length && !hasCount) return;

    for (const m of present) {
        const item = document.createElement('span');
        item.className = 'credits-legend-item ' + TIER_CLASS[m];
        const pip = document.createElement('span');
        pip.className = 'credit-medal-pip';
        item.appendChild(pip);
        const txt = document.createElement('span');
        txt.textContent = tierLabel(m);
        item.appendChild(txt);
        host.appendChild(item);
    }
    if (hasCount) {
        const item = document.createElement('span');
        item.className = 'credits-legend-item';
        const badge = document.createElement('span');
        badge.className = 'credit-count';
        badge.textContent = '×2';
        item.appendChild(badge);
        const txt = document.createElement('span');
        txt.textContent = tSafe('about.legend_count', 'Supported more than once');
        item.appendChild(txt);
        host.appendChild(item);
    }

    // Spell out what the encoding means, once, below the keys.
    const note = document.createElement('p');
    note.className = 'credits-legend-note';
    note.textContent = tSafe('about.tiers_explainer',
        'Bigger avatars and a teal ring mark larger lifetime contributions; ×N shows how many times someone has chipped in.');
    host.appendChild(note);
}

// Cached so an i18n locale change can re-render tier labels + legend
// without re-fetching.
let creditsData = null;

function renderCredits() {
    const contribEl = document.getElementById('contributorsList');
    const supportEl = document.getElementById('supportersList');
    const supporters = (creditsData && creditsData.supporters) || [];
    renderList(contribEl, (creditsData && creditsData.contributors) || [], 'about.empty');
    renderList(supportEl, supporters, 'about.empty');
    renderLegend(supporters);
}

async function loadCredits() {
    try {
        // no-cache: the daemon serves /credits.json with
        // `public, max-age=86400`, so without it a browser can hold a
        // day-old copy and miss tier/count fields added by an update.
        const resp = await fetch('/credits.json', {
            credentials: 'same-origin', cache: 'no-cache'
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        creditsData = await resp.json();
    } catch (e) {
        console.warn('[About] credits.json load failed:', e);
        creditsData = null;
    }
    renderCredits();
}

// Pull tier URLs from i18n catalog so they can be overridden per-locale
// if needed (repo URL, share message). Falls back to safe defaults until
// i18n is hydrated.
function bindSupportTiers() {
    const t = (k, fb) => (window.BYD && window.BYD.i18n && window.BYD.i18n.t)
        ? (window.BYD.i18n.t(k) || fb) : fb;

    const star = document.getElementById('tierStar');
    if (star) star.href = t('about.support.star_url', 'https://github.com/saroz/Overdrive-release');

    const share = document.getElementById('tierShare');
    if (share) {
        share.addEventListener('click', async () => {
            const text = t('about.support.share_message',
                'Check out Overdrive — open-source surveillance & dashcam for BYD: https://github.com/saroz/Overdrive-release');
            try {
                if (navigator.share) {
                    await navigator.share({ text });
                } else if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(text);
                    // toastContainer is in DOM; reuse PWA toast helper if exposed.
                    if (window.BYD?.toast) {
                        window.BYD.toast(t('common.copied', 'Copied'), 'success');
                    } else {
                        console.info('[About] share text copied to clipboard');
                    }
                }
            } catch (e) {
                // User dismissed the share sheet — nothing to surface.
                if (e?.name !== 'AbortError') console.warn('[About] share failed:', e);
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Boot the shared i18n + status pollers the same way every other
    // PWA page does. Without this, the sidebar status card stays at
    // "--" forever and translations don't hydrate.
    if (window.BYD && BYD.core && BYD.i18n) {
        BYD.i18n.init().then(function () {
            BYD.core.init();
        });
    }

    loadCredits();
    loadVehicleInfo();
    // Re-bind on every i18n change so tier URLs/copy follow locale.
    bindSupportTiers();
    if (window.BYD?.i18n?.onChange) {
        window.BYD.i18n.onChange(() => {
            bindSupportTiers();
            // Tier labels and the legend are imperative text with no
            // data-i18n attribute, so hydrate() can't repair them —
            // re-render from the cached data instead.
            if (creditsData) renderCredits();
            renderVehicleInfo();
        });
    }
});
