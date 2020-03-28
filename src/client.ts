import { listen, MessageConnection } from 'vscode-ws-jsonrpc';
import {
    MonacoLanguageClient, CloseAction, ErrorAction,
    MonacoServices, createConnection
} from 'monaco-languageclient';
import normalizeUrl = require('normalize-url');
import { IValidationError } from './IValidationError';
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

const parserUrl = createUrl('/validate')
const parserWebSocket = createWebSocket(parserUrl)

parserWebSocket.addEventListener('open', (conn) => {
    editor.onDidChangeModelContent((e) => {
        const text: string = editor.getValue();

        parserWebSocket.send(JSON.stringify({ code: text }))
    })
})

function giveBackHighlightedHTML(error: IValidationError) {
    let html: string = '<h6 style="color: white">';
    const slice: string = error.line.slice(0, error.characterIndex)
    html += slice;

    html += `<span style="color: white; text-decoration-line: underline; text-decoration-style: wavy; text-decoration-color: red">${error.line.slice(error.characterIndex, error.characterIndex + error.characterCount)}</span>`
    html += `${error.line.slice(error.characterIndex + error.characterCount)}</h6>`
    return html;
}

parserWebSocket.addEventListener('message', (conn) => {
    console.log(conn.data)
    const data = JSON.parse(conn.data)
    const messages: IValidationError[] = JSON.parse(data.errors)
    const element: HTMLDivElement = document.getElementById('output') as HTMLDivElement
    console.log(messages)
    let html = '<div class="errorLine mx-3">'

    for (let i = 0; i < messages.length; i++) {
        let currentError: IValidationError = messages[i];
        let severity: string = "";

        switch (currentError.severity) {
            case 'Error':
                severity = '<i style="color: red">error </i>';
                break;
            case 'Info':
                severity = '<i style="color: blue">info </i>';
                break;
            case 'Warning':
                severity = '<i style="color: orange">warning </i>';
                break;
        }

        html += `
        <div class="row mt-4">
            <h6 style="color: white">Line ${currentError.lineNumber}:${currentError.characterIndex} -> ${severity} <span style="color: grey">${currentError.errorCode}</span>: ${currentError.errorMessage}</h6>
        </div>
        <div class="row">
            <div class="col-1" style="background-color: white; color: black;">${currentError.lineNumber}</div>
            <div class="col-11">${giveBackHighlightedHTML(currentError)}</div>
        </div>
        <div class="row">
            <div class="col-1" style="background-color: white; color: black;"></div>
            <div class="col-11"></div>
        </div>
        <div class="row">
            <h6 style="color: darkgoldenrod;">${currentError.hint}</h6>
        </div>
        `
    }

    html += "</div>"
    element.innerHTML = html;
})


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