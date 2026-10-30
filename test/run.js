"use strict";
const { spawnSync } = require("child_process"); let bad = 0;
for (const f of ["rating.test.js", "online.js"]) { console.log("\n=== " + f); const r = spawnSync(process.execPath, [require("path").join(__dirname, f)], { stdio: "inherit" }); if (r.status) bad++; }
process.exit(bad ? 1 : 0);
