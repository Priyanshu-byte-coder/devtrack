export class RequestBodyTooLargeError extends Error {}
/** Count bytes while reading so chunked requests cannot allocate an unbounded body. */
export async function readBoundedText(
  request: Request,
  maxBytes: number
): Promise<string> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maxBytes)
    throw new RequestBodyTooLargeError("Request too large");
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError("Request too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
