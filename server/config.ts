import path from "path";

export const WS_PORT = parseInt(process.env.WS_PORT ?? "3001", 10);
export const LOG_DIR =
  process.env.DEVFLOW_LOG_DIR ?? path.join(process.cwd(), ".devflow-logs");
