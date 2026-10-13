"use strict";

const fs = require("node:fs");
const path = require("node:path");

const dir = __dirname;
const entryPath = path.join(dir, "plugin-entry.js");
const logicPath = path.join(dir, "logic.js");
const outPath = path.join(dir, "main.js");

function build() {
  const entry = fs.readFileSync(entryPath, "utf8").replace(/^"use strict";\s*/, "");
  if (entry.includes('require("./logic")') || entry.includes("require('./logic')")) {
    throw new Error("plugin-entry.js must use the in-scope logic object, not require('./logic').");
  }
  const logic = fs.readFileSync(logicPath, "utf8").replace(/^"use strict";\s*/, "");
  const bundled = `"use strict";

const logic = (function () {
  const module = { exports: {} };
  const exports = module.exports;
${logic}
  return module.exports;
})();

${entry}`;
  if (bundled.includes('require("./logic")') || bundled.includes("require('./logic')")) {
    throw new Error("bundled main.js still requires ./logic");
  }
  fs.writeFileSync(outPath, bundled);
  return outPath;
}

if (require.main === module) build();

module.exports = { build };
