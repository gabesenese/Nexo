import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = await buildApp();

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .then(() => app.log.info(`Nexo server listening on :${env.PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

/**
 * Without this the process is killed rather than closed on every deploy.
 *
 * A container runs the server as PID 1, and PID 1 does not get the default
 * signal behaviour: an unhandled SIGTERM is ignored outright, so the platform
 * waits out its grace period and sends SIGKILL. Measured before this existed:
 * `docker stop` took the full timeout and the container exited 137.
 *
 * That matters more here than for a plain JSON service. Operators hold an SSE
 * stream open for as long as the dashboard is on screen, and a hard kill drops
 * those mid-event instead of ending them, so the browser sees a network error
 * rather than a closed stream.
 *
 * `app.close()` stops accepting connections, ends the open ones, and lets the
 * in-flight requests finish first.
 */
const SHUTDOWN_TIMEOUT_MS = 10_000;
let shuttingDown = false;

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    /** A second signal during a slow drain means stop waiting, not start again. */
    if (shuttingDown) {
      app.log.warn(`${signal} received again, exiting immediately`);
      process.exit(1);
    }
    shuttingDown = true;
    app.log.info(`${signal} received, closing connections`);

    /** Bounded, so a stuck connection cannot hold the deploy open indefinitely. */
    const failsafe = setTimeout(() => {
      app.log.error("shutdown timed out, exiting");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    failsafe.unref();

    app
      .close()
      .then(() => {
        app.log.info("closed cleanly");
        process.exit(0);
      })
      .catch((err) => {
        app.log.error(err, "error while closing");
        process.exit(1);
      });
  });
}
