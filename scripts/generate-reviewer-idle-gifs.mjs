import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';

const { GIFEncoder, applyPalette, quantize } = gifenc;

const reviewersDir = path.resolve('public/assets/characters/reviewers');
const outputDir = path.join(reviewersDir, 'idle');
const maxOutputHeight = 96;
const frameDelayMs = 250;
const bobOffsets = [2, 0, -2, 0];

function findOpaqueBounds(png) {
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const alpha = png.data[(y * png.width + x) * 4 + 3];
      if (alpha <= 12) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, width: png.width, height: png.height };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function drawScaledFrame(png, bounds, scale, outputWidth, outputHeight, yOffset) {
  const frame = new Uint8Array(outputWidth * outputHeight * 4);
  const scaledWidth = Math.max(1, Math.round(bounds.width * scale));
  const scaledHeight = Math.max(1, Math.round(bounds.height * scale));
  const startX = Math.floor((outputWidth - scaledWidth) / 2);
  const startY = Math.floor((outputHeight - scaledHeight) / 2) + yOffset;

  for (let y = 0; y < scaledHeight; y += 1) {
    const sourceY = Math.min(bounds.height - 1, Math.floor(y / scale));
    const targetY = startY + y;
    if (targetY < 0 || targetY >= outputHeight) continue;

    for (let x = 0; x < scaledWidth; x += 1) {
      const sourceX = Math.min(bounds.width - 1, Math.floor(x / scale));
      const targetX = startX + x;
      if (targetX < 0 || targetX >= outputWidth) continue;

      const sourceIndex = ((bounds.y + sourceY) * png.width + bounds.x + sourceX) * 4;
      const targetIndex = (targetY * outputWidth + targetX) * 4;
      frame[targetIndex] = png.data[sourceIndex];
      frame[targetIndex + 1] = png.data[sourceIndex + 1];
      frame[targetIndex + 2] = png.data[sourceIndex + 2];
      frame[targetIndex + 3] = png.data[sourceIndex + 3];
    }
  }

  return frame;
}

function encodeIdleGif(sourcePath, outputPath) {
  const png = PNG.sync.read(fs.readFileSync(sourcePath));
  const bounds = findOpaqueBounds(png);
  const scale = Math.min(1, maxOutputHeight / bounds.height);
  const outputWidth = Math.max(1, Math.ceil(bounds.width * scale) + 10);
  const outputHeight = Math.max(1, Math.ceil(bounds.height * scale) + 12);
  const frames = bobOffsets.map((offset) => drawScaledFrame(png, bounds, scale, outputWidth, outputHeight, offset));
  const combined = new Uint8Array(frames.length * frames[0].length);

  frames.forEach((frame, index) => {
    combined.set(frame, index * frame.length);
  });

  const palette = quantize(combined, 256, {
    format: 'rgba4444',
    oneBitAlpha: 16,
    clearAlpha: true,
  });
  let transparentIndex = palette.findIndex((color) => color[3] === 0);

  if (transparentIndex === -1) {
    transparentIndex = palette.length;
    palette.push([0, 0, 0, 0]);
  }

  const gif = GIFEncoder();
  frames.forEach((frame, index) => {
    gif.writeFrame(applyPalette(frame, palette, 'rgba4444'), outputWidth, outputHeight, {
      palette: index === 0 ? palette : undefined,
      delay: frameDelayMs,
      repeat: 0,
      transparent: true,
      transparentIndex,
      dispose: 2,
    });
  });
  gif.finish();
  fs.writeFileSync(outputPath, Buffer.from(gif.bytes()));
}

fs.mkdirSync(outputDir, { recursive: true });

const generated = fs
  .readdirSync(reviewersDir)
  .filter((fileName) => fileName.toLowerCase().endsWith('.png'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .map((fileName) => {
    const sourcePath = path.join(reviewersDir, fileName);
    const outputName = `${path.basename(fileName, '.png')}-idle.gif`;
    const outputPath = path.join(outputDir, outputName);
    encodeIdleGif(sourcePath, outputPath);
    return outputName;
  });

console.log(`Generated ${generated.length} reviewer idle GIFs in ${path.relative(process.cwd(), outputDir)}`);
