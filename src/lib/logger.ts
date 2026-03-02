/**
 * MrCA — Structured Logger
 * Phase 9: JSON-structured logs for production observability.
 */

type LogData = Record<string, unknown>;

function serialize(msg: string, data?: LogData) {
  return JSON.stringify({
    msg,
    ...data,
    ts: new Date().toISOString(),
  });
}

export const logger = {
  info: (msg: string, data?: LogData): void => {
    console.log(serialize(msg, { level: "info", ...data }));
  },

  warn: (msg: string, data?: LogData): void => {
    console.warn(serialize(msg, { level: "warn", ...data }));
  },

  error: (msg: string, error?: unknown, data?: LogData): void => {
    const errorMsg =
      error instanceof Error ? error.message : error != null ? String(error) : undefined;
    const stack = error instanceof Error ? error.stack : undefined;
    console.error(
      serialize(msg, {
        level: "error",
        ...(errorMsg !== undefined ? { error: errorMsg } : {}),
        ...(process.env.NODE_ENV === "development" && stack ? { stack } : {}),
        ...data,
      })
    );
  },

  debug: (msg: string, data?: LogData): void => {
    if (process.env.NODE_ENV === "development") {
      console.debug(serialize(msg, { level: "debug", ...data }));
    }
  },
};
