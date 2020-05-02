import {
  createConnection,
  TextDocuments,
  TextDocument,
  Diagnostic,
  DiagnosticSeverity,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  IConnection,
  MessageReader,
  MessageWriter,
} from "vscode-languageserver";
import { Validate } from "@alanj1998/easyops-parser";
import { IValidatorError } from "./IValidatorError.interface";

export function start(
  reader: MessageReader,
  writer: MessageWriter
): EOPSServer {
  const connection = createConnection(reader, writer);
  const server = new EOPSServer(connection);
  server.start();
  return server;
}

interface ExampleSettings {
  maxNumberOfProblems: number;
}

export class EOPSServer {
  protected documents: TextDocuments = new TextDocuments();
  hasConfigurationCapability: boolean = false;
  hasWorkspaceFolderCapability: boolean = false;
  hasDiagnosticRelatedInformationCapability: boolean = false;
  defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
  globalSettings: ExampleSettings = this.defaultSettings;

  // Cache the settings of all open documents
  documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

  constructor(protected readonly connection: IConnection) {
    this.connection.onInitialize((params: InitializeParams) => {
      return this.init(params);
    });

    this.connection.onInitialized(() => {
      this.onInit();
    });

    this.connection.onDidChangeConfiguration((change) => {
      this.onChangeConfiguration(change);
    });

    this.documents.onDidClose((e: any) => {
      this.onClose(e);
    });

    this.documents.onDidChangeContent((change) => {
      this.onContentChange(change);
    });

    this.connection.onCompletion(
      (_textDocumentPosition: TextDocumentPositionParams) =>
        this.onCompletion(_textDocumentPosition)
    );
    this.connection.onCompletionResolve(
      (item: CompletionItem): CompletionItem => {
        return this.onCompletionResolve(item);
      }
    );
  }

  protected init(params: InitializeParams) {
    let capabilities = params.capabilities;

    // Does the client support the `workspace/configuration` request?
    // If not, we will fall back using global settings
    this.hasConfigurationCapability = !!(
      capabilities.workspace && !!capabilities.workspace.configuration
    );
    this.hasWorkspaceFolderCapability = !!(
      capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    this.hasDiagnosticRelatedInformationCapability = !!(
      capabilities.textDocument &&
      capabilities.textDocument.publishDiagnostics &&
      capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    return {
      capabilities: {
        textDocumentSync: this.documents.syncKind,
        // Tell the client that the server supports code completion
        completionProvider: {
          resolveProvider: true,
        },
      },
    };
  }

  protected onInit() {
    if (this.hasConfigurationCapability) {
      this.connection.client.register(
        DidChangeConfigurationNotification.type,
        undefined
      );
    }
    if (this.hasWorkspaceFolderCapability) {
      this.connection.workspace.onDidChangeWorkspaceFolders((_event) => {
        this.connection.console.log("Workspace folder change event received.");
      });
    }
  }

  protected onChangeConfiguration(change: any) {
    if (this.hasConfigurationCapability) {
      // Reset all cached document settings
      this.documentSettings.clear();
    } else {
      this.globalSettings = <ExampleSettings>(
        (change.settings.languageServerExample || this.defaultSettings)
      );
    }
    this.documents.all().forEach(this.validateTextDocument);
  }

  getSeverity(stringSeverity: string): DiagnosticSeverity {
    switch (stringSeverity) {
      case "Warning":
        return DiagnosticSeverity.Warning;
      case "Error":
        return DiagnosticSeverity.Error;
      case "Info":
        return DiagnosticSeverity.Information;
      default:
        return DiagnosticSeverity.Information;
    }
  }

  getStartingIndex(lines: string[], lineNo: number) {
    let startingChar: number = 0;
    for (let i = 0; i < lineNo - 1; i++) {
      startingChar += lines[i].length + 1;
    }

    return startingChar;
  }

  getEndingIndex(
    startingIndex: number,
    charCount: number,
    error: string,
    lines: string[],
    lineNo: number
  ) {
    switch (error) {
      case "Incorrect Resource Declaration.":
        let endingIndex: number = startingIndex;

        for (let i = lineNo - 1; i < lines.length; i++) {
          if (lines[i] === "AND") {
            break;
          }
          endingIndex += lines[i].length + 1;
        }

        return endingIndex;
      default:
        return startingIndex + charCount;
    }
  }

  async validateTextDocument(textDocument: TextDocument): Promise<void> {
    // The validator creates diagnostics for all uppercase words length 2 and more
    let text = textDocument.getText();
    let lines: string[] = text.split("\n");
    let diagnostics: Diagnostic[] = [];
    let validationErrors: IValidatorError[] = JSON.parse(Validate(text));
    // while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {

    for (const validationError of validationErrors) {
      let severity = this.getSeverity(validationError.severity);
      let startingIndex: number =
        this.getStartingIndex(lines, validationError.lineNumber) +
        validationError.characterIndex;
      let diagnostic: Diagnostic = {
        severity,
        range: {
          start: textDocument.positionAt(startingIndex),
          end: textDocument.positionAt(
            this.getEndingIndex(
              startingIndex,
              validationError.characterCount,
              validationError.errorMessage,
              lines,
              validationError.lineNumber
            )
          ),
        },
        message: `${validationError.errorCode}: ${validationError.errorMessage}`,
        source: "EasyOps Validator",
      };
      if (this.hasDiagnosticRelatedInformationCapability) {
        diagnostic.relatedInformation = [
          {
            location: {
              uri: textDocument.uri,
              range: Object.assign({}, diagnostic.range),
            },
            message: validationError.hint,
          },
        ];
      }
      diagnostics.push(diagnostic);
    }
    // Send the computed diagnostics to VSCode.
    this.connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
  }

  onClose(e: any) {
    this.documentSettings.delete(e.document.uri);
  }

  onContentChange(change: any) {
    this.validateTextDocument(change.document);
  }

  onCompletion(
    _textDocumentPosition: TextDocumentPositionParams
  ): CompletionItem[] {
    return [
      {
        label: "Create VM",
        kind: CompletionItemKind.Snippet,
        data: 3,
        insertText: "using provider\ncreate virtual_machine\ncalled name",
      },
    ];
  }

  onCompletionResolve(item: CompletionItem): CompletionItem {
    if (item.data === 1) {
      item.detail = "Set the provider to aws for this block of code";
      item.documentation = "Creates a snippet of 'using aws'";
    } else if (item.data === 2) {
      item.detail = "Set the provider to azure for this block of code";
      item.documentation = "Creates a snippet of 'using azure'";
    } else if (item.data === 3) {
      item.detail = "Creates a VM resource with defaults";
    }
    return item;
  }

  start() {
    this.documents.listen(this.connection);

    // Listen on the connection
    this.connection.listen();
  }
}
