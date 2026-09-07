export function stripGpsExif(input: Buffer, mimeType: string): Buffer {
  if (mimeType !== "image/jpeg" && mimeType !== "image/jpg") return input;
  return stripJpegExif(input);
}

function stripJpegExif(input: Buffer): Buffer {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return input;
  const chunks: Buffer[] = [input.subarray(0, 2)];
  let i = 2;
  while (i + 3 < input.length) {
    if (input[i] !== 0xff) {
      chunks.push(input.subarray(i));
      break;
    }
    const marker = input[i + 1]!;
    if (marker === 0xda || marker === 0xd9) {
      chunks.push(input.subarray(i));
      break;
    }
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      chunks.push(input.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const len = (input[i + 2]! << 8) | input[i + 3]!;
    if (len < 2) break;
    const skipApp1 = marker === 0xe1;
    if (!skipApp1) chunks.push(input.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return Buffer.concat(chunks);
}
