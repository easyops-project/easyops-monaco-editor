require("./routing");

require("monaco-editor-core");
(self as any).MonacoEnvironment = {
  getWorkerUrl: () => "./editor.worker.bundle.js"
};
require("./client");
require("./maps")