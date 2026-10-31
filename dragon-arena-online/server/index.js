"use strict";
const { createServer } = require("./server");
const port = +process.env.PORT || 3000;
const srv = createServer({});
srv.start(port).catch(e => { console.error("Falha ao iniciar:", e); process.exit(1); });
const bye = async () => { try { await srv.stop(); } finally { process.exit(0); } };
process.on("SIGTERM", bye); process.on("SIGINT", bye);
