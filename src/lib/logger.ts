/**
 * Simple Logger Wrapper
 * 環境変数 VITE_LOG_LEVEL による出力制御機能付き
 */

type Level = "DEBUG" | "INFO" | "WARN" | "ERROR" | "NONE";

/**
 * 環境変数からログレベルを解析（大文字小文字を区別しない）
 */
function parseLogLevel(levelString?: string): Level {
  if (!levelString) {
    return "DEBUG"; // デフォルト値
  }
  
  const upperLevel = levelString.toUpperCase() as Level;
  const validLevels: Level[] = ["DEBUG", "INFO", "WARN", "ERROR", "NONE"];
  
  if (validLevels.includes(upperLevel)) {
    return upperLevel;
  }
  
  // 無効な値の場合はデフォルトでDEBUGレベルを使用
  return "DEBUG";
}

const LOG_LEVEL = parseLogLevel(import.meta.env.VITE_LOG_LEVEL);

const order: Record<Level, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  NONE: 99,
};

const enabled = (level: Level) => order[level] >= order[LOG_LEVEL];

type LogFn = (...args: unknown[]) => void;

const noop: LogFn = () => {};

export const logger: Record<"debug" | "info" | "warn" | "error", LogFn> = {
  debug: enabled("DEBUG") ? console.debug.bind(console) : noop,
  info: enabled("INFO") ? console.info.bind(console) : noop,
  warn: enabled("WARN") ? console.warn.bind(console) : noop,
  error: enabled("ERROR") ? console.error.bind(console) : noop,
};

// TypeScript型定義のエクスポート
export type { Level, LogFn };