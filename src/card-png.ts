/**
 * SVG → PNG without a browser. @resvg/resvg-js is an optional dependency:
 * when its prebuilt binary is missing for this platform, callers fall back
 * to writing the SVG. The bundled OFL fonts make the card look identical on
 * every OS instead of depending on what happens to be installed.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FONT_FILES = [
  "SpaceGrotesk-Medium.ttf",
  "SpaceGrotesk-Bold.ttf",
  "JetBrainsMono-Regular.ttf",
  "JetBrainsMono-Bold.ttf",
];

function fontDir(): string {
  // dist/card-png.js and src/card-png.ts both sit one level below the package root.
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fonts");
}

/** PNG bytes at 2x for crisp previews, or undefined when resvg is unavailable. */
export function svgToPng(svg: string): Buffer | undefined {
  let Resvg: typeof import("@resvg/resvg-js").Resvg;
  try {
    Resvg = createRequire(import.meta.url)("@resvg/resvg-js").Resvg;
  } catch {
    return undefined;
  }
  const dir = fontDir();
  const fontFiles = FONT_FILES.map((f) => path.join(dir, f)).filter((f) => fs.existsSync(f));
  const resvg = new Resvg(svg, {
    fitTo: { mode: "zoom", value: 2 },
    font: {
      fontFiles,
      loadSystemFonts: fontFiles.length === 0,
      defaultFontFamily: "Space Grotesk",
    },
  });
  return resvg.render().asPng();
}
