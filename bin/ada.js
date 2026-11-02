#!/usr/bin/env node
// Comando del paquete. Sin argumentos abre el chat. Ver `ada --help`.

import { main } from "../src/cli.js";
import { turn, fixedLayers } from "../src/harness.js";
import { loadRouting } from "../src/context.js";
import { listen } from "../src/server.js";

await main(process.argv.slice(2), { turn, fixedLayers, loadRouting, listen, defaultCommand: "serve" });
