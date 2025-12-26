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

const pythonUri = "file:///c:/temp/python-lsp/scratch-lsp/src/solution.py";

export async function initPythonLsp(): Promise<LanguageServerSession> {

  const cp = spawn("pyright-langserver",
  ["--stdio"],
  {
    stdio: ["pipe", "pipe", "pipe"],
    shell: true
  });
  const reader = new StreamMessageReader(cp.stdout);
  const writer = new StreamMessageWriter(cp.stdin);

  const connection = createMessageConnection(reader, writer);

  cp.stderr.on("data", (d) => console.error("pyright stderr:", d.toString()));
  connection.onNotification((method, params) => {
    // Helpful to see everything the server emits while debugging.
    console.log("pyright LSP notification:", method, JSON.stringify(params, null, 2));
  });
  connection.onNotification("window/logMessage", (m: unknown) =>
    console.log("pyright LSP log:", JSON.stringify(m, null, 2))
  );
  connection.onNotification("window/showMessage", (m: unknown) =>
    console.warn("pyright LSP msg:", JSON.stringify(m, null, 2))
  );

  const projectRoot = "file:///c:/temp/python-lsp/scratch-lsp";
  connection.listen();

  const params: InitializeParams = {
    processId: process.pid,
    rootUri: projectRoot,
    workspaceFolders: [{ uri: projectRoot, name: "scratch-lsp" }],
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

  console.log("pyright initialized. Server capabilities received.");

  connection.sendNotification("initialized", {});
  new Promise<void>((resolve) =>
    setTimeout(() => {
      resolve();
    }, 5000)
  );

  connection.sendNotification("textDocument/didOpen", {
    textDocument: {
      uri: pythonUri,
      languageId: "python",
      version: 1,
      text: "def hello():\n  pass",
    },
  });

  return {
    connection: connection,
    process: cp,
    docUri: pythonUri,
    docVersion: 1
  };
}
