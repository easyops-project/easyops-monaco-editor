import { listen, MessageConnection } from 'vscode-ws-jsonrpc';
import {
    MonacoLanguageClient, CloseAction, ErrorAction,
    MonacoServices, createConnection
} from 'monaco-languageclient';
import normalizeUrl = require('normalize-url');
const ReconnectingWebSocket = require('reconnecting-websocket');

// register Monaco languages
monaco.languages.register({
    id: "eops",
    aliases: ["EasyOps DSL", "eops"],
    extensions: [".eops", "."]
});
monaco.languages.setMonarchTokensProvider('eops', {
    tokenizer: {
        root: [
            [/(using|create|called|with|AND) /, "keyword.other.eops"],
            [/(allowed_in|allowed_out|location|) /, "entity.name.type"],
            [/\t(os|cores|ram|disks:|gpus:|vpc|optimisation) /, "entity.name.type"]
        ]
    }
});

// Define a new theme that contains only rules that match this language
monaco.editor.defineTheme('myCoolTheme', {
    base: 'vs-dark',
    inherit: true,
    rules: [
        { token: 'keywords', foreground: 'ffffff' },
        { token: 'custom-error', foreground: 'ff0000', fontStyle: 'bold' },
        { token: 'custom-notice', foreground: 'FFA500' },
        { token: 'custom-date', foreground: '008800' },
    ],
    colors: {}
});

// create Monaco editor
const editor = monaco.editor.create(document.getElementById("editor")!, {
    language: "eops",
    theme: "myCoolTheme",
    value: ""
});

// install Monaco language client services
MonacoServices.install(editor);

// create the web socket
const url = createUrl('/eopsCheck')
const webSocket = createWebSocket(url);
// listen when the web socket is opened
listen({
    webSocket,
    onConnection: connection => {
        // create and start the language client
        const languageClient = createLanguageClient(connection);
        const disposable = languageClient.start();
        connection.onClose(() => disposable.dispose());
    }
});

function createLanguageClient(connection: MessageConnection): MonacoLanguageClient {
    return new MonacoLanguageClient({
        name: "EOPS DSL",
        clientOptions: {
            // use a language id as a document selector
            documentSelector: ['eops'],
            // disable the default error handler
            errorHandler: {
                error: () => ErrorAction.Continue,
                closed: () => CloseAction.DoNotRestart
            }
        },
        // create a language client connection from the JSON RPC connection on demand
        connectionProvider: {
            get: (errorHandler, closeHandler) => {
                return Promise.resolve(createConnection(connection, errorHandler, closeHandler))
            }
        }
    });
}

function createUrl(path: string): string {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    return normalizeUrl(`${protocol}://${location.host}${location.pathname}${path}`);
}

function createWebSocket(url: string): WebSocket {
    const socketOptions = {
        maxReconnectionDelay: 10000,
        minReconnectionDelay: 1000,
        reconnectionDelayGrowFactor: 1.3,
        connectionTimeout: 10000,
        maxRetries: Infinity,
        debug: false
    };
    return new ReconnectingWebSocket(url, [], socketOptions);
}