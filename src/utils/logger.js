export const logger = {
  error: (...args) => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[ERROR]", ...args);
    }
    // Add error tracking service calls here (Sentry, etc.)
  },

  warn: (...args) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[WARN]", ...args);
    }
  },

  info: (...args) => {
    if (process.env.NODE_ENV !== "production") {
      console.info("[INFO]", ...args);
    }
  },

  debug: (...args) => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[DEBUG]", ...args);
    }
  },
  log: (...args) => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[log]", ...args);
    }
  },
};
