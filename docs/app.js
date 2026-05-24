const times = ["19:00", "19:30", "20:00"];

const els = {
  form: document.getElementById("snipe-form"),
  platform: document.getElementById("platform"),
  venueLabel: document.getElementById("venue-label"),
  venueHint: document.getElementById("venue-hint"),
  timesList: document.getElementById("times-list"),
  newTime: document.getElementById("new_time"),
  addTime: document.getElementById("add-time"),
  mode: document.getElementById("mode"),
  dropField: document.getElementById("drop-field"),
  targetDate: document.getElementById("target_date"),
  dropAt: document.getElementById("drop_at"),
  outputSection: document.getElementById("output-section"),
  yamlOutput: document.getElementById("yaml-output"),
  copyYaml: document.getElementById("copy-yaml"),
};

function updatePlatformHints() {
  const isOT = els.platform.value === "opentable";
  els.venueLabel.textContent = isOT ? "Restaurant ID (rid)" : "Resy venue ID";
  document.getElementById("venue_id").placeholder = isOT ? "8033" : "6194";
  els.venueHint.textContent = isOT
    ? "From OpenTable URL ?rid=8033 or npm run search:opentable"
    : "Run npm run search -- \"Carbone\" locally";
}

function renderTimes() {
  els.timesList.innerHTML = times
    .map(
      (t) =>
        `<span class="time-tag">${t}<button type="button" data-time="${t}">×</button></span>`
    )
    .join("");

  els.timesList.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = times.indexOf(btn.dataset.time);
      if (idx >= 0) times.splice(idx, 1);
      renderTimes();
    });
  });
}

function suggestDropTime(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 30);
  dt.setHours(9, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T09:00`;
}

function toIsoUtc(localDatetime) {
  if (!localDatetime) return "";
  return new Date(localDatetime).toISOString();
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

els.platform.addEventListener("change", updatePlatformHints);

els.addTime.addEventListener("click", () => {
  const t = els.newTime.value.trim();
  if (t && !times.includes(t)) {
    times.push(t);
    renderTimes();
  }
  els.newTime.value = "";
});

els.newTime.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    els.addTime.click();
  }
});

els.mode.addEventListener("change", () => {
  els.dropField.hidden = els.mode.value !== "drop";
});

els.targetDate.addEventListener("change", () => {
  if (els.mode.value === "drop" && !els.dropAt.value) {
    els.dropAt.value = suggestDropTime(els.targetDate.value);
  }
  const id = document.getElementById("id");
  const name = document.getElementById("name").value;
  if (!id.value && name && els.targetDate.value) {
    id.value = `${slugify(name)}-${els.targetDate.value}`;
  }
});

els.form.addEventListener("submit", (e) => {
  e.preventDefault();

  if (times.length === 0) {
    alert("Add at least one preferred time");
    return;
  }

  const platform = els.platform.value;
  const id = document.getElementById("id").value.trim();
  const name = document.getElementById("name").value.trim();
  const venueId = document.getElementById("venue_id").value.trim();
  const targetDate = els.targetDate.value;
  const partySize = parseInt(document.getElementById("party_size").value, 10);
  const mode = els.mode.value;
  const dryRun = document.getElementById("dry_run").checked;
  const enabled = document.getElementById("enabled").checked;

  const entry = {
    id,
    enabled,
    platform,
    venue_id: venueId,
    restaurant_name: name,
    target_date: targetDate,
    party_size: partySize,
    preferred_times: times,
    mode,
    dry_run: dryRun,
  };

  if (mode === "drop") {
    const dropLocal = els.dropAt.value;
    if (!dropLocal) {
      alert("Set a drop time for drop snipe mode");
      return;
    }
    entry.drop_at = toIsoUtc(dropLocal);
  }

  const lines = ["  - id: " + entry.id];
  lines.push("    enabled: " + entry.enabled);
  lines.push("    platform: " + entry.platform);
  lines.push('    venue_id: "' + entry.venue_id + '"');
  lines.push("    restaurant_name: " + entry.restaurant_name);
  lines.push('    target_date: "' + entry.target_date + '"');
  lines.push("    party_size: " + entry.party_size);
  lines.push("    preferred_times:");
  for (const t of entry.preferred_times) {
    lines.push('      - "' + t + '"');
  }
  lines.push("    mode: " + entry.mode);
  if (entry.drop_at) lines.push('    drop_at: "' + entry.drop_at + '"');
  lines.push("    dry_run: " + entry.dry_run);

  els.yamlOutput.textContent = lines.join("\n");
  els.outputSection.hidden = false;
  els.outputSection.scrollIntoView({ behavior: "smooth" });
});

els.copyYaml.addEventListener("click", () => {
  navigator.clipboard.writeText(els.yamlOutput.textContent).then(() => {
    els.copyYaml.textContent = "Copied!";
    setTimeout(() => (els.copyYaml.textContent = "Copy YAML"), 2000);
  });
});

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 30);
els.targetDate.value = tomorrow.toISOString().slice(0, 10);
els.dropAt.value = suggestDropTime(els.targetDate.value);
els.dropField.hidden = false;
updatePlatformHints();
renderTimes();
