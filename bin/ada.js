#!/usr/bin/env node
// Comando del paquete. Sin argumentos abre el chat. Ver `ada --help`.

import { main } from "../dist/src/cli.js";
import { turn, fixedLayers } from "../dist/src/harness.js";
import { loadRouting } from "../dist/src/context.js";
import { listen } from "../dist/src/server.js";

await main(process.argv.slice(2), { turn, fixedLayers, loadRouting, listen, defaultCommand: "serve" });
