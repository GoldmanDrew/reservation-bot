const form = document.getElementById("snipe-form");
const targetDate = document.getElementById("target_date");

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 30);
targetDate.value = tomorrow.toISOString().slice(0, 10);

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const date = targetDate.value;
  const party = document.getElementById("party_size").value;
  const times = document.getElementById("times").value.trim();
  const dryRun = document.getElementById("dry_run").checked;

  const params = new URLSearchParams({
    "workflow_file": "create-snipe.yml",
  });

  const workflowUrl = "https://github.com/GoldmanDrew/reservation-bot/actions/workflows/create-snipe.yml";

  const instructions = [
    "Open Create Snipe workflow and click Run workflow.",
    "",
    `restaurant_name: ${name}`,
    `target_date: ${date}`,
    `party_size: ${party}`,
    `preferred_times: ${times}`,
    `dry_run: ${dryRun ? "true" : "false"}`,
  ].join("\n");

  navigator.clipboard.writeText(instructions).catch(() => {});

  alert(
    "Opening GitHub Actions.\n\nValues copied to clipboard — paste into the workflow form:\n\n" +
      instructions
  );

  window.open(workflowUrl, "_blank");
});
