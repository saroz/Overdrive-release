/* Moved out of local/login.html (security fix F9: no inline scripts). */
// Initialize i18n
BYD.i18n.init();

function t(key, fallback) {
    const v = (window.BYD && BYD.i18n && BYD.i18n.t) ? BYD.i18n.t(key) : null;
    return (v && v !== key) ? v : fallback;
}

function getLoginRedirect() {
    try {
        // URLSearchParams already decodes the query parameter once.
        const value = new URLSearchParams(window.location.search).get('redirect');
        if (!value || /[\\\x00-\x1f\x7f]/.test(value)) return '/';

        // Validate escapes without changing the path, query or fragment.
        decodeURIComponent(value);
        const destination = new URL(value, window.location.href);
        if ((destination.protocol !== 'http:' && destination.protocol !== 'https:') ||
                destination.origin !== window.location.origin ||
                destination.username || destination.password) {
            return '/';
        }
        // Keep the authority: a normalized pathname beginning with // must
        // not be reinterpreted as a foreign host during navigation.
        return destination.href;
    } catch (e) {
        return '/';
    }
}
const redirectUrl = getLoginRedirect();

// Store device ID for token construction
let deviceId = '';

// Set initial loading text (localized if catalog is already hot, else fallback)
function setInitialLoadingText() {
    const el = document.getElementById('deviceIdDisplay');
    if (deviceId) return; // Don't overwrite a real ID
    const loadingText = (window.BYD && BYD.i18n && BYD.i18n.t)
        ? (BYD.i18n.t('common.loading') || 'Loading...')
        : 'Loading...';
    el.textContent = loadingText;
}

// Check device info on load
async function checkDevice() {
    try {
        // Show "Loading..." while we fetch
        setInitialLoadingText();

        const response = await fetch('/auth/status');
        const data = await response.json();

        const displayEl = document.getElementById('deviceIdDisplay');
        if (data.deviceId && data.deviceId !== 'unknown') {
            deviceId = data.deviceId;
            updateDeviceIdDisplay();
        } else {
            displayEl.textContent = t('login.unknown_device', 'Unknown device');
        }
    } catch (e) {
        console.error('Failed to check device:', e);
        const displayEl = document.getElementById('deviceIdDisplay');
        displayEl.textContent = t('login.connection_error', 'Connection error');
    }
}

// Apply device ID to the DOM. We don't use data-i18n on the value element
// because the i18n hydration engine would overwrite our dynamic ID
// with the translated "Loading..." string.
function updateDeviceIdDisplay() {
    if (deviceId) {
        const el = document.getElementById('deviceIdDisplay');
        el.textContent = deviceId;
    }
}

// Listen for language changes to ensure the "Loading..." state is
// localized if the catalog loads before the fetch completes.
if (window.BYD && BYD.i18n && BYD.i18n.onChange) {
    BYD.i18n.onChange(function() {
        if (!deviceId) setInitialLoadingText();
    });
}

// Show status message
function showStatus(message, type) {
    const el = document.getElementById('statusMessage');
    el.textContent = message;
    el.className = 'status-message visible ' + type;
}

function hideStatus() {
    document.getElementById('statusMessage').className = 'status-message';
}

// Login with access code
async function login() {
    const accessCode = document.getElementById('tokenInput').value.trim().toLowerCase();
    const btn = document.getElementById('loginBtn');
    const btnText = document.getElementById('loginBtnText');
    const spinner = document.getElementById('loginSpinner');
    const errorEl = document.getElementById('tokenError');

    if (!accessCode) {
        errorEl.textContent = t('login.enter_code', 'Please enter your access code');
        errorEl.classList.add('visible');
        document.getElementById('tokenInput').classList.add('error');
        return;
    }

    // Minimum, not an exact length: devices paired before the secret length was
    // raised still carry an 8-char code, newer ones are longer. The server is the
    // real judge, so this only catches an obviously-incomplete entry.
    if (accessCode.length < 8) {
        // Distinct from the empty-field message above, and length-agnostic:
        // codes are 8 chars on devices paired before the length increase and
        // longer on newer ones, so we cannot name an expected length here.
        errorEl.textContent = t('login.invalid_code', 'Invalid access code');
        errorEl.classList.add('visible');
        document.getElementById('tokenInput').classList.add('error');
        return;
    }

    if (!deviceId) {
        showStatus(t('login.device_id_missing', 'Device ID not loaded. Please refresh.'), 'error');
        return;
    }

    // Combine device ID + access code to form full token
    const fullToken = deviceId + '-' + accessCode;

    // Clear errors
    errorEl.classList.remove('visible');
    document.getElementById('tokenInput').classList.remove('error');
    hideStatus();

    // Show loading
    btn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'block';

    try {
        const response = await fetch('/auth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: fullToken })
        });

        const data = await response.json();

        if (data.success) {
            // Store JWT in cookie AND localStorage (localStorage is more reliable through tunnels)
            const maxAge = data.expiresIn || (365 * 24 * 60 * 60);
            const isSecure = window.location.protocol === 'https:';
            const sameSite = isSecure ? 'Lax; Secure' : 'Lax';
            document.cookie = `byd_session=${data.jwt}; path=/; max-age=${maxAge}; SameSite=${sameSite}`;

            // Also store in localStorage as backup (tunnels can drop cookies)
            try {
                localStorage.setItem('byd_jwt', data.jwt);
            } catch (e) {
                console.warn('Could not save to localStorage:', e);
            }

            showStatus(t('login.success', 'Login successful! Redirecting...'), 'success');

            // Redirect after short delay
            setTimeout(() => {
                window.location.href = redirectUrl;
            }, 500);
        } else {
            errorEl.textContent = data.error || t('login.invalid_code', 'Invalid access code');
            errorEl.classList.add('visible');
            document.getElementById('tokenInput').classList.add('error');
        }
    } catch (e) {
        showStatus(t('login.connection_retry', 'Connection error. Please try again.'), 'error');
    } finally {
        btn.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

// Enter key handler
document.getElementById('tokenInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        login();
    }
});

// Initialize
checkDevice();
