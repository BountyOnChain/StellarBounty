const path = require("node:path");

function quote(files) {
  return files
    .map((file) => `"${file.replace(/(["\\$`])/g, "\\$1")}"`)
    .join(" ");
}

function relativeTo(directory, files) {
  const absoluteDirectory = path.resolve(directory);
  return files
    .map((file) => path.relative(absoluteDirectory, path.resolve(file)))
    .filter((file) => !file.startsWith("..") && !path.isAbsolute(file));
}

function eslintFrom(directory, files) {
  const relativeFiles = relativeTo(directory, files);
  if (relativeFiles.length === 0) return [];

  return [`cd ${directory} && eslint --fix ${quote(relativeFiles)}`];
}

module.exports = {
  "*.{json,md,yml,yaml,css,scss,cjs,mjs,js}": (files) => [
    `prettier --write ${quote(files)}`,
  ],
  "apps/backend/src/**/*.ts": (files) => [
    `prettier --write ${quote(files)}`,
    ...eslintFrom("apps/backend", files),
  ],
  "apps/frontend/**/*.{ts,tsx}": (files) => [
    `prettier --write ${quote(files)}`,
    ...eslintFrom("apps/frontend", files),
  ],
};
