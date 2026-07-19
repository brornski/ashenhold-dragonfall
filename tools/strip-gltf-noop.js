"use strict";

const fs = require("fs");
const path = require("path");

const files = process.argv.slice(2);
if (!files.length) throw new Error("Pass one or more .glb files.");

function align4(buffer, fill) {
  const padding = (4 - buffer.length % 4) % 4;
  return padding ? Buffer.concat([buffer, Buffer.alloc(padding, fill)]) : buffer;
}

for (const file of files) {
  const source = fs.readFileSync(file);
  if (source.readUInt32LE(0) !== 0x46546c67 || source.readUInt32LE(4) !== 2) throw new Error(file + " is not glTF 2.0 binary.");
  const chunks = [];
  let offset = 12;
  while (offset < source.length) {
    const length = source.readUInt32LE(offset);
    const type = source.readUInt32LE(offset + 4);
    chunks.push({ type, data: source.subarray(offset + 8, offset + 8 + length) });
    offset += 8 + length;
  }
  const jsonChunk = chunks.find((chunk) => chunk.type === 0x4e4f534a);
  if (!jsonChunk) throw new Error(file + " has no JSON chunk.");
  const document = JSON.parse(jsonChunk.data.toString("utf8").trim());
  let removed = 0;
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.extensions && value.extensions.KHR_texture_transform) {
      const transform = value.extensions.KHR_texture_transform;
      const keys = Object.keys(transform);
      if (keys.some((key) => key !== "texCoord") || (transform.texCoord != null && transform.texCoord !== 0)) {
        throw new Error(file + " contains a non-noop KHR_texture_transform; refusing to change it.");
      }
      delete value.extensions.KHR_texture_transform;
      if (!Object.keys(value.extensions).length) delete value.extensions;
      removed += 1;
    }
    Object.keys(value).forEach((key) => visit(value[key]));
  };
  visit(document);
  if (!removed) {
    process.stdout.write(path.basename(file) + ": already clean\n");
    continue;
  }
  const stillUsed = JSON.stringify(document).includes("KHR_texture_transform");
  if (!stillUsed) {
    if (Array.isArray(document.extensionsUsed)) document.extensionsUsed = document.extensionsUsed.filter((id) => id !== "KHR_texture_transform");
    if (Array.isArray(document.extensionsRequired)) document.extensionsRequired = document.extensionsRequired.filter((id) => id !== "KHR_texture_transform");
  }
  const jsonData = align4(Buffer.from(JSON.stringify(document)), 0x20);
  const outputChunks = chunks.map((chunk) => chunk === jsonChunk ? { type: chunk.type, data: jsonData } : chunk);
  const totalLength = 12 + outputChunks.reduce((sum, chunk) => sum + 8 + chunk.data.length, 0);
  const output = Buffer.alloc(totalLength);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(totalLength, 8);
  offset = 12;
  outputChunks.forEach((chunk) => {
    output.writeUInt32LE(chunk.data.length, offset);
    output.writeUInt32LE(chunk.type, offset + 4);
    chunk.data.copy(output, offset + 8);
    offset += 8 + chunk.data.length;
  });
  const temporary = file + ".clean.tmp";
  fs.writeFileSync(temporary, output);
  const verified = fs.readFileSync(temporary);
  if (verified.readUInt32LE(8) !== verified.length) throw new Error(file + " verification failed.");
  fs.renameSync(temporary, file);
  process.stdout.write(path.basename(file) + ": removed " + removed + " no-op transforms\n");
}
