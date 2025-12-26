import { ChildProcess } from "node:child_process"
import { initRustLsp } from "./rust.js"
import { initPythonLsp } from "./python.js"
import type { MessageConnection } from "vscode-jsonrpc"

export type LspSessionKey = {
    userId: string,
    kataId: string,
    editorId: string,
    language: string
}

export type LanguageServerSession = {
    process: ChildProcess,
    connection: MessageConnection,
    docUri: string,
    docVersion: number,
    killTimer?: NodeJS.Timeout
}

export type LspSession = {
    sessionKey: LspSessionKey,
    languageServer: LanguageServerSession
}

const sessions: Record<string, LspSession> = { };

function stringifyKey(key: LspSessionKey): string {
    return JSON.stringify(key);
}

export async function ensureLspSession(sessionKey: LspSessionKey): Promise<LspSession> {
    let existingSession = sessions[stringifyKey(sessionKey)];
    if(existingSession) {
        return existingSession;
    }

    let lspProcess: LanguageServerSession;
    switch(sessionKey.language) {
        case "rust":   lspProcess = await initRustLsp();   break;
        case "python": lspProcess = await initPythonLsp(); break;
        default: throw Error(`Language ${sessionKey.language} not supported.`);
    }
    lspProcess.killTimer = setTimeout(() => { 
        console.info(`LSP session for ${JSON.stringify(sessionKey)}, pid=${lspProcess.process.pid ?? 'unknown' } expired.`);
        lspProcess.process.kill(); 
    }, 3 * 60 * 1000);
    let session = {
        languageServer: lspProcess,
        sessionKey
    }

    sessions[stringifyKey(sessionKey)] = session;
    return session;
}