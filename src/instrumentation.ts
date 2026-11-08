export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { blankSlateOnBoot } = await import("./instrumentation-node");
    await blankSlateOnBoot();
  }
}
