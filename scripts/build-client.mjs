import { build } from "esbuild";
import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const publicDir = join(root, "public");
await build({
  entryPoints: [join(publicDir, "face3d.js")],
  outfile: join(publicDir, "face3d.bundle.js"),
  bundle: true,
  format: "esm",
  minify: true,
  target: ["es2022"],
});
const basis = join(publicDir, "basis");
mkdirSync(basis, { recursive: true });
for (const name of ["basis_transcoder.js", "basis_transcoder.wasm"]) {
  cpSync(join(root, "node_modules", "three", "examples", "jsm", "libs", "basis", name), join(basis, name));
}
console.log("3D face bundle and texture decoder prepared");
