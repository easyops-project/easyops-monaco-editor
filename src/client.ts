import { listen, MessageConnection } from "vscode-ws-jsonrpc";
import {
  MonacoLanguageClient,
  CloseAction,
  ErrorAction,
  MonacoServices,
  createConnection,
} from "monaco-languageclient";
import normalizeUrl = require("normalize-url");
import { IValidationError } from "./IValidationError";
import { addServer, clearResources } from "./maps";
import { setActiveRoute } from "./routing";
const ReconnectingWebSocket = require("reconnecting-websocket");
// import { debounce } from "ts-debounce"

// const getCode = debounce(() => {
//     const text: string = editor.getValue();

//     parserWebSocket.send(JSON.stringify({ code: text }))
// })
// register Monaco languages
monaco.languages.register({
  id: "eops",
  aliases: ["EasyOps DSL", "eops"],
  extensions: [".eops", "."],
});
monaco.languages.setMonarchTokensProvider("eops", {
  tokenizer: {
    root: [
      [/(using|create|called|with|AND)/, "keyword.other.eops"],
      [/(allowed_in|allowed_out|location|)/, "entity.name.type"],
      [/    (os|cores|ram|disks:|gpus:|vpc|optimisation)/, "entity.name.type"],
    ],
  },
});

// Define a new theme that contains only rules that match this language
monaco.editor.defineTheme("myCoolTheme", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "keywords", foreground: "ffffff" },
    { token: "custom-error", foreground: "ff0000", fontStyle: "bold" },
    { token: "custom-notice", foreground: "FFA500" },
    { token: "custom-date", foreground: "008800" },
  ],
  colors: {},
});

// create Monaco editor
const editor = monaco.editor.create(document.getElementById("editor")!, {
  language: "eops",
  theme: "myCoolTheme",
  value: "",
});

// install Monaco language client services
MonacoServices.install(editor);

// create the web socket
const url = createUrl("/eopsCheck");
const webSocket = createWebSocket(url);
// listen when the web socket is opened
listen({
  webSocket,
  onConnection: (connection) => {
    // create and start the language client
    const languageClient = createLanguageClient(connection);
    const disposable = languageClient.start();
    connection.onClose(() => disposable.dispose());
  },
});

const parserUrl = createUrl("/validate");
const parserWebSocket = createWebSocket(parserUrl);

parserWebSocket.addEventListener("open", (conn) => {
  editor.onDidChangeModelContent((e) => {
    const text: string = editor.getValue();
    console.log(text);

    parserWebSocket.send(JSON.stringify({ code: text }));
  });
});

function giveBackHighlightedHTML(error: IValidationError) {
  let html: string = '<h6 style="color: white">';
  const slice: string = error.line.slice(0, error.characterIndex);
  html += slice;

  html += `<span style="color: white; text-decoration-line: underline; text-decoration-style: wavy; text-decoration-color: red">${error.line.slice(
    error.characterIndex,
    error.characterIndex + error.characterCount
  )}</span>`;
  html += `${error.line.slice(
    error.characterIndex + error.characterCount
  )}</h6>`;
  return html;
}

parserWebSocket.addEventListener("message", async (conn) => {
  const data = JSON.parse(conn.data);

  if (data.errors) {
    const messages: IValidationError[] = JSON.parse(data.errors);
    const element: HTMLDivElement = document.getElementById(
      "output"
    ) as HTMLDivElement;
    let html = '<div class="errorLine mx-3">';

    for (let i = 0; i < messages.length; i++) {
      let currentError: IValidationError = messages[i];
      let severity: string = "";

      switch (currentError.severity) {
        case "Error":
          severity = '<i style="color: red">error </i>';
          break;
        case "Info":
          severity = '<i style="color: blue">info </i>';
          break;
        case "Warning":
          severity = '<i style="color: orange">warning </i>';
          break;
      }

      html += `
        <div class="row mt-4">
            <h6 style="color: white">Line ${currentError.lineNumber}:${
        currentError.characterIndex
      } -> ${severity} <span style="color: grey">${
        currentError.errorCode
      }</span>: ${currentError.errorMessage}</h6>
        </div>
        <div class="row">
            <div class="col-1" style="background-color: white; color: black;">${
              currentError.lineNumber
            }</div>
            <div class="col-11">${giveBackHighlightedHTML(currentError)}</div>
        </div>
        <div class="row">
            <div class="col-1" style="background-color: white; color: black;"></div>
            <div class="col-11"></div>
        </div>
        <div class="row">
            <h6 style="color: darkgoldenrod;">${currentError.hint}</h6>
        </div>
        `;
    }

    html += "</div>";
    element.innerHTML = html;

    setActiveRoute("Output");
  } else if (data.parsedOutput) {
    const element: HTMLDivElement = document.getElementById(
      "output"
    ) as HTMLDivElement;
    element.innerHTML = "";
    const resArr = JSON.parse(data.parsedOutput);
    clearResources();
    for (const resource of resArr) {
      if (resource.type === "Virtual_Machine") {
        await addServer(resource);
      }
    }

    setActiveRoute("Map");
  }
});

function createLanguageClient(
  connection: MessageConnection
): MonacoLanguageClient {
  return new MonacoLanguageClient({
    name: "EOPS DSL",
    clientOptions: {
      // use a language id as a document selector
      documentSelector: ["eops"],
      // disable the default error handler
      errorHandler: {
        error: () => ErrorAction.Continue,
        closed: () => CloseAction.DoNotRestart,
      },
    },
    // create a language client connection from the JSON RPC connection on demand
    connectionProvider: {
      get: (errorHandler, closeHandler) => {
        return Promise.resolve(
          createConnection(connection, errorHandler, closeHandler)
        );
      },
    },
  });
}

function createUrl(path: string): string {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  return normalizeUrl(
    `${protocol}://${location.host}${location.pathname}${path}`
  );
}

function createWebSocket(url: string): WebSocket {
  const socketOptions = {
    maxReconnectionDelay: 10000,
    minReconnectionDelay: 1000,
    reconnectionDelayGrowFactor: 1.3,
    connectionTimeout: 10000,
    maxRetries: Infinity,
    debug: false,
  };
  return new ReconnectingWebSocket(url, [], socketOptions);
}
