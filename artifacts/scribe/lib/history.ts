import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "scribe.history.";
const MAX_SNAPSHOTS = 20;
const MIN_INTERVAL_MS = 3 * 60 * 1000;
const MIN_DIFF_CHARS = 40;

export type Snapshot = {
  content: string;
  savedAt: number;
};

export async function getSnapshots(noteId: string): Promise<Snapshot[]> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + noteId);
    if (!raw) return [];
    return JSON.parse(raw) as Snapshot[];
  } catch {
    return [];
  }
}

export async function maybeSnapshot(
  noteId: string,
  content: string,
): Promise<void> {
  try {
    const snaps = await getSnapshots(noteId);
    const last = snaps[snaps.length - 1];
    if (last) {
      const timeOk = Date.now() - last.savedAt >= MIN_INTERVAL_MS;
      const diffOk =
        Math.abs(content.length - last.content.length) >= MIN_DIFF_CHARS;
      if (!timeOk && !diffOk) return;
      if (last.content === content) return;
    }
    const next = [...snaps, { content, savedAt: Date.now() }].slice(
      -MAX_SNAPSHOTS,
    );
    await AsyncStorage.setItem(PREFIX + noteId, JSON.stringify(next));
  } catch {
    // best-effort
  }
}

export async function clearSnapshots(noteId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + noteId);
  } catch {
    // ignore
  }
}
