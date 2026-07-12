import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

const SAF = FileSystem.StorageAccessFramework;

const TEXT_EXTS = new Set([
  "md",
  "mdown",
  "markdown",
  "txt",
  "text",
  "log",
  "rst",
]);
const COVER_RE = /^cover\.(jpe?g|png|webp|gif)$/i;
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

export type SafFolder = {
  uri: string;
  relativePath: string;
};

export type SafFile = {
  uri: string;
  name: string;
  ext: string;
  folderPath: string;
};

export type SafCover = {
  folderPath: string;
  uri: string;
  ext: string;
};

export type SafTree = {
  folders: SafFolder[];
  files: SafFile[];
  covers: SafCover[];
};

export const isAndroidSafSupported = (): boolean =>
  Platform.OS === "android" && !!SAF;

function decodeFilename(uri: string): string {
  try {
    const docPart = uri.split("/document/")[1] ?? uri.split("/tree/")[1] ?? uri;
    const decoded = decodeURIComponent(docPart);
    const afterColon = decoded.includes(":")
      ? decoded.slice(decoded.indexOf(":") + 1)
      : decoded;
    const lastSlash = afterColon.lastIndexOf("/");
    const result = lastSlash >= 0 ? afterColon.slice(lastSlash + 1) : afterColon;
    return result || "Untitled";
  } catch {
    return "Untitled";
  }
}

function splitNameExt(filename: string): { name: string; ext: string } {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return { name: filename, ext: "" };
  return {
    name: filename.slice(0, dot),
    ext: filename.slice(dot + 1).toLowerCase(),
  };
}

export async function pickFolder(): Promise<{
  uri: string;
  name: string;
} | null> {
  if (!isAndroidSafSupported()) return null;
  const perms = await SAF.requestDirectoryPermissionsAsync();
  if (!perms.granted) return null;
  const uri = perms.directoryUri;
  const name = decodeFilename(uri);
  return { uri, name };
}

async function classifyEntry(uri: string): Promise<"dir" | "file" | "unknown"> {
  // Try the official info API first (works for most SAF URIs).
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      const isDir = (info as { isDirectory?: boolean }).isDirectory;
      if (typeof isDir === "boolean") return isDir ? "dir" : "file";
    }
  } catch {
    // Fall through to probe.
  }
  // Fallback: try to read as directory — succeeds for dirs, throws for files
  // *and* for some legitimate directories on certain SAF providers (e.g. when
  // the probe itself is denied/flaky). We can't tell those two cases apart
  // here, so we report "unknown" and let the caller decide based on filename
  // — assuming "file" unconditionally used to fabricate real folders into
  // fake .txt notes (bug: connected-folder subfolders showing up as .txt).
  try {
    await SAF.readDirectoryAsync(uri);
    return "dir";
  } catch {
    return "unknown";
  }
}

export async function scanFolderTree(rootUri: string): Promise<SafTree> {
  if (!isAndroidSafSupported())
    return { folders: [], files: [], covers: [] };

  const folders: SafFolder[] = [];
  const files: SafFile[] = [];
  const covers: SafCover[] = [];

  async function visit(uri: string, relativePath: string): Promise<void> {
    let entries: string[] = [];
    try {
      entries = await SAF.readDirectoryAsync(uri);
    } catch (err) {
      console.warn("readDirectoryAsync failed for", relativePath, err);
      return;
    }

    // Classify in small concurrent batches to be kind to Android
    const BATCH = 8;
    const classified: { uri: string; kind: "dir" | "file" | "unknown" }[] = [];
    for (let i = 0; i < entries.length; i += BATCH) {
      const slice = entries.slice(i, i + BATCH);
      const r = await Promise.all(
        slice.map(async (entryUri) => ({
          uri: entryUri,
          kind: await classifyEntry(entryUri),
        })),
      );
      classified.push(...r);
    }

    for (const { uri: entryUri, kind } of classified) {
      const filename = decodeFilename(entryUri);

      if (kind === "dir") {
        const folderName = filename || "Folder";
        const childPath =
          relativePath === "/"
            ? `/${folderName}`
            : `${relativePath}/${folderName}`;
        folders.push({ uri: entryUri, relativePath: childPath });
        await visit(entryUri, childPath);
        continue;
      }

      const { name, ext } = splitNameExt(filename);

      if (kind === "unknown") {
        // Ambiguous entry: the directory probe failed but that also happens
        // for legitimate folders on some SAF providers. An extension is a
        // strong signal it's really a file; extension-less entries are far
        // more likely to be folders, so recurse into them as a folder
        // instead of fabricating a bogus .txt note. Worst case we get an
        // empty folder entry, which is harmless — unlike corrupting a real
        // directory into a fake writable note.
        if (!ext) {
          const folderName = filename || "Folder";
          const childPath =
            relativePath === "/"
              ? `/${folderName}`
              : `${relativePath}/${folderName}`;
          folders.push({ uri: entryUri, relativePath: childPath });
          await visit(entryUri, childPath);
          continue;
        }
      }

      if (COVER_RE.test(filename)) {
        covers.push({ folderPath: relativePath, uri: entryUri, ext });
        continue;
      }
      if (TEXT_EXTS.has(ext)) {
        files.push({
          uri: entryUri,
          name,
          ext,
          folderPath: relativePath,
        });
      } else if (!ext && kind === "file") {
        // No extension but confirmed to be a real file (not a probe
        // failure) — treat as text file, useful for plain notes.
        files.push({
          uri: entryUri,
          name: filename,
          ext: "txt",
          folderPath: relativePath,
        });
      }
      // Other binary files (images, pdfs, etc.) are skipped silently
      void IMAGE_EXTS; // eslint-disable-line @typescript-eslint/no-unused-expressions
    }
  }

  await visit(rootUri, "/");
  return { folders, files, covers };
}

export async function readFile(uri: string): Promise<string> {
  return await SAF.readAsStringAsync(uri);
}

export async function writeFile(uri: string, content: string): Promise<void> {
  await SAF.writeAsStringAsync(uri, content);
}

export async function readImageAsDataUri(
  uri: string,
  ext: string,
): Promise<string | null> {
  if (!isAndroidSafSupported()) return null;
  try {
    const base64 = await SAF.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mime =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : "image/jpeg";
    return `data:${mime};base64,${base64}`;
  } catch (err) {
    console.warn("Failed to read cover image", err);
    return null;
  }
}

export async function createFile(
  parentUri: string,
  name: string,
  ext: "md" | "txt",
): Promise<{ uri: string }> {
  const mimeType = ext === "md" ? "text/markdown" : "text/plain";
  const uri = await SAF.createFileAsync(parentUri, name, mimeType);
  return { uri };
}

export async function createSubFolder(
  parentUri: string,
  folderName: string,
): Promise<{ uri: string }> {
  const uri = await SAF.makeDirectoryAsync(parentUri, folderName);
  return { uri };
}

export async function deleteUri(uri: string): Promise<void> {
  await SAF.deleteAsync(uri);
}
