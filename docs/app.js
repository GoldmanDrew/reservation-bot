const form = document.getElementById("snipe-form");
const targetDate = document.getElementById("target_date");
const authBtn = document.getElementById("auth-btn");
const deviceModal = document.getElementById("device-modal");
const deviceCodeEl = document.getElementById("device-code");
const deviceWaitEl = document.getElementById("device-wait");
const deviceLink = document.getElementById("device-link");
const deviceCancel = document.getElementById("device-cancel");
const snipeStatus = document.getElementById("snipe-status");
const otForm = document.getElementById("opentable-form");
const otStatus = document.getElementById("ot-status");

let oauthConfig = null;
let devicePollTimer = null;

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

function openDeviceModal() {
  deviceModal.classList.add("open");
  deviceModal.setAttribute("aria-hidden", "false");
}

function closeDeviceModal() {
  deviceModal.classList.remove("open");
  deviceModal.setAttribute("aria-hidden", "true");
  stopDevicePoll();
}

function stopDevicePoll() {
  if (devicePollTimer) {
    clearInterval(devicePollTimer);
    devicePollTimer = null;
  }
}

async function startDevicePoll(intervalSec) {
  stopDevicePoll();
  const waitMs = Math.max(3, intervalSec || 5) * 1000;
  devicePollTimer = setInterval(async () => {
    try {
      const result = await ReservationOAuth.pollDeviceAuth(oauthConfig);
      if (result.pending) return;
      closeDeviceModal();
      await ReservationOAuth.refreshAuthUi(authBtn);
      setStatus(snipeStatus, "Signed in with GitHub.");
      setStatus(otStatus, "");
    } catch (err) {
      closeDeviceModal();
      setStatus(snipeStatus, err.message || String(err), true);
    }
  }, waitMs);
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
    deviceCodeEl.textContent = device.user_code;
    deviceLink.href = device.verification_uri;
    deviceWaitEl.textContent = "Waiting for authorization…";
    openDeviceModal();
    await startDevicePoll(device.interval);
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
})();
