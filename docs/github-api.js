/** GitHub API helpers for reservation-bot Pages (dispatch + encrypted secrets). */
(function (global) {
  const GH_REPO = "GoldmanDrew/reservation-bot";
  const DISPATCH_EVENT = "create-snipe";
  const TEST_TELEGRAM_EVENT = "test-telegram";
  let sodiumReady = null;

  function apiHeaders(token) {
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  async function loadSodium() {
    if (sodiumReady) return sodiumReady;
    if (global.sodium) {
      sodiumReady = global.sodium.ready.then(() => global.sodium);
      return sodiumReady;
    }
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/libsodium-wrappers@0.7.15/dist/browsers-sumo/libsodium-wrappers.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Failed to load libsodium"));
      document.head.appendChild(script);
    });
    sodiumReady = global.sodium.ready.then(() => global.sodium);
    return sodiumReady;
  }

  async function githubFetch(token, path, options = {}) {
    const res = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers: {
        ...apiHeaders(token),
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }
    if (!res.ok) {
      const msg =
        data?.message ||
        data?.raw ||
        `GitHub API ${res.status} ${path}`;
      throw new Error(msg);
    }
    return data;
  }

  async function dispatchCreateSnipe(token, payload) {
    return githubFetch(token, `/repos/${GH_REPO}/dispatches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: DISPATCH_EVENT,
        client_payload: payload,
      }),
    });
  }

  async function getRepoPublicKey(token) {
    return githubFetch(token, `/repos/${GH_REPO}/actions/secrets/public-key`);
  }

  async function putRepoSecret(token, name, value) {
    const sodium = await loadSodium();
    const { key_id, key } = await getRepoPublicKey(token);
    const messageBytes = sodium.from_string(value);
    const keyBytes = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
    const encryptedBytes = sodium.crypto_box_seal(messageBytes, keyBytes);
    const encrypted = sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);

    return githubFetch(token, `/repos/${GH_REPO}/actions/secrets/${encodeURIComponent(name)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        encrypted_value: encrypted,
        key_id,
      }),
    });
  }

  function normalizeCookieInput(raw) {
    let value = raw.trim();
    if (!value) throw new Error("Cookie value is empty");
    if (/^cookie:\s*/i.test(value)) {
      value = value.replace(/^cookie:\s*/i, "").trim();
    }
    if (value.startsWith("http://") || value.startsWith("https://")) {
      throw new Error("Paste the Cookie header value, not a URL");
    }
    return value;
  }

  async function dispatchTestTelegram(token) {
    return githubFetch(token, `/repos/${GH_REPO}/dispatches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: TEST_TELEGRAM_EVENT, client_payload: {} }),
    });
  }

  global.ReservationGitHub = {
    GH_REPO,
    DISPATCH_EVENT,
    TEST_TELEGRAM_EVENT,
    dispatchCreateSnipe,
    dispatchTestTelegram,
    putRepoSecret,
    normalizeCookieInput,
  };
})(window);
