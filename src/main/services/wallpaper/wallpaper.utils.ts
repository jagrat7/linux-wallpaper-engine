import * as fs from "node:fs/promises";

type ImageType = "jpeg" | "png" | "bmp";

const IMAGE_HEADERS_IDENTIFIERS = {
  jpeg: 0xffd8,
  png: 0x89504e47,
  bmp: 0x424d,
};
const MAX_BYTES = 8192;

export async function parseImageHeader(imagePath: string) {
  try {
    const file = await fs.open(imagePath, "r");
    const buffer = Buffer.alloc(8192); // 8kb
    const { bytesRead } = await file.read(buffer, 0, MAX_BYTES, 0);
    await file.close();

    const res = { height: 0, width: 0 };

    if (matchHeader(buffer, "png")) {
      // https://en.wikipedia.org/wiki/PNG#Examples
      const widthOffset = 16;
      const heightOffset = widthOffset + 4;
      res.width = buffer.readUInt32BE(widthOffset);
      res.height = buffer.readUInt32BE(heightOffset);
    } else if (matchHeader(buffer, "bmp")) {
      // BMP uses little endian
      const widthOffset = 18;
      const heightOffset = widthOffset + 4;
      res.width = buffer.readUInt32LE(widthOffset);
      res.height = buffer.readUInt32LE(heightOffset);
    } else if (matchHeader(buffer, "jpeg")) {
      // https://stackoverflow.com/questions/14414884
      let offset = 2;
      while (offset < bytesRead - 8) {
        if (buffer[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = buffer[offset + 1];

        if (
          marker >= 0xc0 &&
          marker <= 0xcf &&
          ![0xc4, 0xc8, 0xcc].includes(marker)
        ) {
          const heightOffset = offset + 5;
          const widthOffset = heightOffset + 2;
          res.height = buffer.readUInt16BE(heightOffset);
          res.width = buffer.readUInt16BE(widthOffset);
          break;
        }
        offset += 2 + buffer.readUInt16BE(offset + 2); // 2 + length segment, +2 so we skip the marker
      }
    }

    return res;
  } catch (err) {
    return { height: 0, width: 0 };
  }
}

function matchHeader(buffer: Buffer, imageType: ImageType) {
  switch (imageType) {
    case "jpeg":
      return buffer.readUInt16BE(0) === IMAGE_HEADERS_IDENTIFIERS[imageType];

    case "png":
      return buffer.readUInt32BE(0) === IMAGE_HEADERS_IDENTIFIERS[imageType];

    case "bmp":
      return buffer.readUInt16BE(0) === IMAGE_HEADERS_IDENTIFIERS[imageType];
  }
}
