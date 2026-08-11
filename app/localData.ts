export const MOIRAI_STORAGE_KEYS = {
  records: "olympus-tarot-archive",
  favorites: "moirai-favorites",
  settings: "moirai-settings",
} as const;

export type ReadingRecord = {
  id: string;
  createdAt: string;
  question: string;
  spread: "single" | "three" | "celtic";
  cards: { id: string; position: string; orientation?: "upright" | "reversed" }[];
};

export type MoiraiBackup = {
  format: "moirai-local-backup";
  schemaVersion: 1;
  appVersion: string;
  exportedAt: string;
  data: {
    records: ReadingRecord[];
    favorites: string[];
    settings: Record<string, unknown>;
  };
};

function parseStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

export function readRecords(): ReadingRecord[] {
  const records = parseStored<unknown>(MOIRAI_STORAGE_KEYS.records, []);
  return Array.isArray(records) ? records as ReadingRecord[] : [];
}

export function createBackup(records: ReadingRecord[]): MoiraiBackup {
  return {
    format: "moirai-local-backup",
    schemaVersion: 1,
    appVersion: "1.0.0",
    exportedAt: new Date().toISOString(),
    data: {
      records,
      favorites: parseStored<string[]>(MOIRAI_STORAGE_KEYS.favorites, []),
      settings: parseStored<Record<string, unknown>>(MOIRAI_STORAGE_KEYS.settings, {}),
    },
  };
}

export function parseBackup(value: unknown): MoiraiBackup {
  if (!value || typeof value !== "object") throw new Error("备份文件格式无效");
  const backup = value as Partial<MoiraiBackup>;
  if (backup.format !== "moirai-local-backup" || backup.schemaVersion !== 1 || !backup.data) {
    throw new Error("这不是兼容的 MOIRAI 备份文件");
  }
  if (!Array.isArray(backup.data.records) || !Array.isArray(backup.data.favorites) || typeof backup.data.settings !== "object") {
    throw new Error("备份文件缺少必要的数据字段");
  }
  return backup as MoiraiBackup;
}

export function restoreBackup(backup: MoiraiBackup) {
  localStorage.setItem(MOIRAI_STORAGE_KEYS.records, JSON.stringify(backup.data.records));
  localStorage.setItem(MOIRAI_STORAGE_KEYS.favorites, JSON.stringify(backup.data.favorites));
  localStorage.setItem(MOIRAI_STORAGE_KEYS.settings, JSON.stringify(backup.data.settings));
}

export function clearLocalMoiraiData() {
  localStorage.removeItem(MOIRAI_STORAGE_KEYS.records);
  localStorage.removeItem(MOIRAI_STORAGE_KEYS.favorites);
  localStorage.removeItem(MOIRAI_STORAGE_KEYS.settings);
  sessionStorage.removeItem("moirai-oracle-connection");
}
