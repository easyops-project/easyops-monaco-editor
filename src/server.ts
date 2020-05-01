import * as ws from "ws";
import * as http from "http";
import * as url from "url";
import * as net from "net";
import * as express from "express";
import * as rpc from "vscode-ws-jsonrpc";
import { launch } from "./lang/eops-server-launcher";
const opn = require("opn");
import { Validate, Parse } from "@alanj1998/easyops-parser";

process.on("uncaughtException", function (err: any) {
  console.error("Uncaught Exception: ", err.toString());
  if (err.stack) {
    console.error(err.stack);
  }
});

// create the express application
const app = express();
// server the static content, i.e. index.html
app.use(express.static(__dirname));
// start the server

export function startServer() {
  const server = app.listen(3000, () => {
    console.log("EasyOPS Code Environment started at http://localhost:3000");
    opn("http://localhost:3000");
  });
  // create the web socket
  const wss = new ws.Server({
    noServer: true,
    perMessageDeflate: false,
  });
  server.on(
    "upgrade",
    (request: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
      const pathname = request.url
        ? url.parse(request.url).pathname
        : undefined;
      if (pathname === "/eopsCheck") {
        wss.handleUpgrade(request, socket, head, (webSocket) => {
          const socket: rpc.IWebSocket = {
            send: (content) =>
              webSocket.send(content, (error) => {
                if (error) {
                  throw error;
                }
              }),
            onMessage: (cb) => webSocket.on("message", cb),
            onError: (cb) => webSocket.on("error", cb),
            onClose: (cb) => webSocket.on("close", cb),
            dispose: () => webSocket.close(),
          };
          // launch the server when the web socket is opened
          if (webSocket.readyState === webSocket.OPEN) {
            launch(socket);
          } else {
            webSocket.on("open", () => launch(socket));
          }
        });
      } else if (pathname === "/validate") {
        wss.handleUpgrade(request, socket, head, (webSocket) => {
          try {
            webSocket.on("message", (data) => {
              const msg: { code: string } = JSON.parse(data);
              const res = Validate(msg.code || "");

              if (JSON.parse(res).length == 0) {
                const res = Parse(msg.code);
                webSocket.send(JSON.stringify({ parsedOutput: res }));
              } else webSocket.send(JSON.stringify({ errors: res }));
            });
          } catch (error) {
            webSocket.send(error);
          }
        });
      }
    }
  );
}
