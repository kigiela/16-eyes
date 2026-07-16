#!/usr/bin/env node
import { run } from "../src/cli.js";

run(process.argv.slice(2)).catch((err) => {
  console.error(`16-eyes: ${err && err.message ? err.message : err}`);
  process.exitCode = 1;
});
