export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { seedCredentialsFromEnv } = await import("@/lib/credentials");
    await seedCredentialsFromEnv();

    const { startScheduler } = await import("@/lib/sniper/scheduler");
    startScheduler();
  }
}
