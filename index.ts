#!/usr/bin/env bun

import { Command } from "commander";
import { runwakeup } from "./tui/wakeup"


const program = new Command();

program
    .name("techcodeclaw-build")
    .description("techcodeclaw cli yt")
    .version("0.0.1");


program
    .command("wakeup")
    .description("show the banner and pick cli or teligram mode")
    .action(
        async() => {
            await runwakeup()
        });

await program.parseAsync(process.argv);