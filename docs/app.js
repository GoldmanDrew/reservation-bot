const form = document.getElementById("snipe-form");
const targetDate = document.getElementById("target_date");
const authBtn = document.getElementById("auth-btn");
const deviceModal = document.getElementById("device-modal");
const deviceCodeEl = document.getElementById("device-code");
const deviceWaitEl = document.getElementById("device-wait");
const deviceLink = document.getElementById("device-link");
const deviceCancel = document.getElementById("device-cancel");
const deviceOpenBtn = document.getElementById("device-open");
const snipeStatus = document.getElementById("snipe-status");
const otForm = document.getElementById("opentable-form");
const otStatus = document.getElementById("ot-status");

let oauthConfig = null;
let devicePollTimer = null;
let devicePollDelayMs = 5000;
let devicePollAttempts = 0;

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 30);
targetDate.value = tomorrow.toISOString().slice(0, 10);

function setStatus(el, text, isError = false) {
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("status-error", isError);
}

function requireAuth() {
  const token = ReservationOAuth.getToken();
  if (token) return token;
  throw new Error("Sign in with GitHub first (top right)");
}

function deviceAuthorizeUrl(userCode) {
  return `https://github.com/login/device?user_code=${encodeURIComponent(userCode)}`;
}

function openDeviceModal(device) {
  deviceCodeEl.textContent = device.user_code;
  deviceLink.href = device.verification_uri;
  if (deviceOpenBtn) {
    deviceOpenBtn.onclick = () => window.open(device.verification_uri, "_blank", "noopener");
  }
  devicePollAttempts = 0;
  setDeviceWait("Waiting for authorization…");
  deviceModal.classList.add("open");
  deviceModal.setAttribute("aria-hidden", "false");
  navigator.clipboard.writeText(device.user_code).catch(() => {});
}

function closeDeviceModal() {
  deviceModal.classList.remove("open");
  deviceModal.setAttribute("aria-hidden", "true");
  stopDevicePoll();
}

function setDeviceWait(text, isError = false) {
  setStatus(deviceWaitEl, text, isError);
}

function stopDevicePoll() {
  if (devicePollTimer) {
    clearTimeout(devicePollTimer);
    devicePollTimer = null;
  }
}

async function pollDeviceOnce() {
  const result = await ReservationOAuth.pollDeviceAuth(oauthConfig);
  if (result.pending) {
    devicePollAttempts += 1;
    if (result.slow) {
      devicePollDelayMs = Math.min(devicePollDelayMs + 5000, 30000);
    }
    if (devicePollAttempts >= 6) {
      setDeviceWait(
        "Still waiting — on GitHub, enter the code and click Authorize (not just Continue). " +
          `Checked ${devicePollAttempts} times.`
      );
    } else {
      setDeviceWait(`Waiting for authorization… (checked ${devicePollAttempts})`);
    }
    return false;
  }

  closeDeviceModal();
  await ReservationOAuth.refreshAuthUi(authBtn);
  setStatus(snipeStatus, "Signed in with GitHub.");
  setStatus(otStatus, "");
  return true;
}

function scheduleDevicePoll() {
  stopDevicePoll();
  devicePollTimer = setTimeout(async () => {
    try {
      const done = await pollDeviceOnce();
      if (!done) scheduleDevicePoll();
    } catch (err) {
      setDeviceWait(err.message || String(err), true);
      stopDevicePoll();
    }
  }, devicePollDelayMs);
}

async function startDevicePoll(intervalSec) {
  devicePollDelayMs = Math.max(3, intervalSec || 5) * 1000;
  try {
    await pollDeviceOnce();
  } catch (err) {
    setDeviceWait(err.message || String(err), true);
    return;
  }
  scheduleDevicePoll();
}

async function beginDeviceSignIn() {
  if (!oauthConfig?.client_id) {
    alert(
      "OAuth not configured yet.\n\n" +
        "1. Create a GitHub OAuth App with Device Flow\n" +
        "2. Deploy docs/oauth-proxy to Cloudflare\n" +
        "3. Set repo variables OAUTH_CLIENT_ID and OAUTH_PROXY_URL\n" +
        "4. Redeploy Pages"
    );
    return;
  }

  const device = await ReservationOAuth.signIn(oauthConfig.client_id, oauthConfig);
  openDeviceModal(device);
  window.open(device.verification_uri, "_blank", "noopener");
  await startDevicePoll(device.interval);
}

async function handleAuthClick() {
  if (authBtn.dataset.signedIn === "1") {
    ReservationOAuth.clearAuth();
    ReservationOAuth.cancelDeviceAuth();
    await ReservationOAuth.refreshAuthUi(authBtn);
    setStatus(snipeStatus, "Signed out.");
    return;
  }

  try {
    await beginDeviceSignIn();
  } catch (err) {
    setStatus(snipeStatus, err.message || String(err), true);
  }
}

authBtn.addEventListener("click", handleAuthClick);
deviceCancel.addEventListener("click", () => {
  ReservationOAuth.cancelDeviceAuth();
  closeDeviceModal();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus(snipeStatus, "Dispatching Create Snipe workflow…");

  try {
    const token = requireAuth();
    const name = document.getElementById("name").value.trim();
    const date = targetDate.value;
    const party = document.getElementById("party_size").value;
    const times = document.getElementById("times").value.trim();
    const dryRun = document.getElementById("dry_run").checked;

    await ReservationGitHub.dispatchCreateSnipe(token, {
      restaurant_name: name,
      target_date: date,
      party_size: party,
      preferred_times: times,
      dry_run: dryRun ? "true" : "false",
    });

    setStatus(
      snipeStatus,
      `Snipe dispatched for ${name} on ${date}. Watch Actions for progress.`
    );
  } catch (err) {
    setStatus(snipeStatus, err.message || String(err), true);
  }
});

otForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus(otStatus, "Saving OpenTable session to GitHub Secrets…");

  try {
    const token = requireAuth();
    const cookies = ReservationGitHub.normalizeCookieInput(
      document.getElementById("ot_cookies").value
    );
    const csrf = document.getElementById("ot_csrf").value.trim();

    await ReservationGitHub.putRepoSecret(token, "OPENTABLE_COOKIES", cookies);
    if (csrf) {
      await ReservationGitHub.putRepoSecret(token, "OPENTABLE_CSRF_TOKEN", csrf);
    }

    setStatus(otStatus, "Saved OPENTABLE_COOKIES to repo secrets.");
    document.getElementById("ot_cookies").value = "";
  } catch (err) {
    setStatus(otStatus, err.message || String(err), true);
  }
});

(async function init() {
  try {
    oauthConfig = await ReservationOAuth.loadConfig();
  } catch {
    oauthConfig = { client_id: "" };
  }
  await ReservationOAuth.refreshAuthUi(authBtn);

  if (sessionStorage.getItem("oauth_device")) {
    try {
      const dev = JSON.parse(sessionStorage.getItem("oauth_device"));
      if (dev.user_code) {
        openDeviceModal({
          user_code: dev.user_code,
          verification_uri: deviceAuthorizeUrl(dev.user_code),
        });
        await startDevicePoll(dev.interval || 5);
      }
    } catch {
      sessionStorage.removeItem("oauth_device");
    }
  }
})();
