import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type MessageConnection,
} from "vscode-jsonrpc/lib/node/main.js";
import type {
  InitializeParams,
  InitializeResult,
} from "vscode-languageserver-protocol";
import { spawn } from "child_process";
import type { LanguageServerSession } from "./index.js";

import { pathToFileURL } from "node:url";
import path from "node:path";

const TEMPLATES = process.env.LSP_TEMPLATES_DIR;
if(!TEMPLATES)
  throw Error("LSP_TEMPLATES_DIR not set");

const phpProjectRoot = path.join(TEMPLATES, "php");
const phpFile = path.join(phpProjectRoot, "solution.php");

const phpUri = pathToFileURL(phpFile).toString();
const projectRoot = pathToFileURL(phpProjectRoot).toString();

export async function initPhpLsp(): Promise<LanguageServerSession> {

  const cp = spawn("intelephense",
  ["--stdio"],
  {
    stdio: ["pipe", "pipe", "pipe"],
    shell: true
  });
  const reader = new StreamMessageReader(cp.stdout);
  const writer = new StreamMessageWriter(cp.stdin);

  const connection = createMessageConnection(reader, writer);

  cp.stderr.on("data", (d) => console.error("intelephense stderr:", d.toString()));
  connection.onNotification((method, params) => {
    // Helpful to see everything the server emits while debugging.
    console.log("intelephense LSP notification:", method, JSON.stringify(params, null, 2));
  });
  connection.onNotification("window/logMessage", (m: unknown) =>
    console.log("intelephense LSP log:", JSON.stringify(m, null, 2))
  );
  connection.onNotification("window/showMessage", (m: unknown) =>
    console.warn("intelephense LSP msg:", JSON.stringify(m, null, 2))
  );

  connection.listen();

  const params: InitializeParams = {
    processId: process.pid,
    rootUri: projectRoot,
    workspaceFolders: [ { uri: projectRoot, name: "php" } ],
    initializationOptions: {
      serverStatusNotification: "On",
    },
    capabilities: {
      textDocument: {
        completion: { completionItem: { snippetSupport: false } },
      },
    },
  };

  const result = (await connection.sendRequest(
    "initialize",
    params
  )) as InitializeResult;

  console.log("intelephense initialized. Server capabilities received.");

  connection.sendNotification("initialized", {});
  new Promise<void>((resolve) =>
    setTimeout(() => {
      resolve();
    }, 5000)
  );

  connection.sendNotification("textDocument/didOpen", {
    textDocument: {
      uri: phpUri,
      languageId: "php",
      version: 1,
      text: "<?php\nfunction hello(){ }",
    },
  });

  return {
    connection: connection,
    process: cp,
    docUri: phpUri,
    docVersion: 1
  };
}
