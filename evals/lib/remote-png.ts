import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const pendingImages = new Map<string, Promise<string>>();

export interface RemotePngSource {
  url: string;
  sha256: string;
}

export interface ResolveRemotePngOptions {
  maxBytes?: number;
  signal?: AbortSignal;
}

/** Resolves a verified remote PNG into the ignored shared eval cache. */
export function resolveRemotePng(
  source: RemotePngSource,
  options: ResolveRemotePngOptions = {},
): Promise<string> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const pendingKey = `${source.sha256}:${maxBytes}`;
  let pending = pendingImages.get(pendingKey);
  if (!pending) {
    pending = downloadRemotePng(source, maxBytes).catch((error) => {
      pendingImages.delete(pendingKey);
      throw error;
    });
    pendingImages.set(pendingKey, pending);
  }

  return waitForImage(pending, options.signal);
}

async function downloadRemotePng(
  source: RemotePngSource,
  maxBytes: number,
): Promise<string> {
  const sha256 = source.sha256.toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error(`Invalid remote PNG SHA-256: ${source.sha256}`);
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error(`Invalid remote PNG size limit: ${maxBytes}`);
  }

  const cacheDirectory = resolve(".vitest-evals/fixtures/images");
  const cachePath = resolve(cacheDirectory, `${sha256}.png`);
  const cached = await readFile(cachePath).catch(() => undefined);
  if (cached && cached.length <= maxBytes && verifyImage(cached, sha256)) {
    return cachePath;
  }

  const url = new URL(source.url);
  if (url.protocol !== "https:") {
    throw new Error(`Remote eval PNG URL must use HTTPS: ${source.url}`);
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to download remote eval PNG: ${response.status} ${response.statusText}`,
    );
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(
      `Remote eval PNG exceeds ${maxBytes} bytes: ${contentLength}`,
    );
  }

  const image = await readBoundedResponse(response, maxBytes);
  if (image.length === 0) {
    throw new Error("Remote eval PNG response was empty");
  }
  if (!verifyImage(image, sha256)) {
    throw new Error(
      `Remote eval PNG did not match expected format and SHA-256 ${sha256}`,
    );
  }

  await mkdir(cacheDirectory, { recursive: true });
  const temporaryPath = `${cachePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, image);
    await rename(temporaryPath, cachePath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
  return cachePath;
}

async function readBoundedResponse(
  response: Response,
  maxBytes: number,
): Promise<Buffer> {
  if (!response.body) {
    throw new Error("Remote eval PNG response had no body");
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error(`Remote eval PNG exceeds ${maxBytes} bytes`);
      }
      chunks.push(Buffer.from(chunk.value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, totalBytes);
}

function waitForImage(
  pending: Promise<string>,
  signal?: AbortSignal,
): Promise<string> {
  if (!signal) return pending;
  if (signal.aborted) return Promise.reject(abortReason(signal));

  return new Promise((resolvePromise, rejectPromise) => {
    const abort = () => rejectPromise(abortReason(signal));
    signal.addEventListener("abort", abort, { once: true });
    pending.then(resolvePromise, rejectPromise).finally(() => {
      signal.removeEventListener("abort", abort);
    });
  });
}

function abortReason(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason;
  const error = new Error("Remote eval PNG resolution was aborted");
  error.name = "AbortError";
  return error;
}

function verifyImage(image: Buffer, sha256: string): boolean {
  if (!image.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return false;
  }
  return createHash("sha256").update(image).digest("hex") === sha256;
}
