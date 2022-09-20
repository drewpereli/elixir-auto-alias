import * as vscode from 'vscode';
import {
  documentAlreadyHasAlias,
  documentDefinesModule,
  moduleParts,
  textEditForForModule,
} from './utils/document-analysis';

export default class AutocompletionProvider
  implements vscode.CompletionItemProvider
{
  constructor(private modules: string[]) {}

  public provideCompletionItems(
    document: vscode.TextDocument
  ): Thenable<vscode.CompletionItem[]> {
    const items: vscode.CompletionItem[] = this.modules
      .map((moduleName) => this.completionItemForModule(moduleName, document))
      .filter((item): item is vscode.CompletionItem => item !== undefined);

    return Promise.resolve(items);
  }

  private completionItemForModule(
    moduleName: string,
    document: vscode.TextDocument
  ): vscode.CompletionItem | undefined {
    const text = document.getText();

    if (documentDefinesModule(moduleName, text)) {
      return;
    }

    if (documentAlreadyHasAlias(moduleName, text)) {
      return;
    }

    const edit = textEditForForModule(moduleName, text);

    const parts = moduleParts(moduleName);

    const startPos = new vscode.Position(edit.start.line, edit.start.character);
    const endPos = edit.end
      ? new vscode.Position(edit.end.line, edit.end.character)
      : startPos;

    const editRange = new vscode.Range(startPos, endPos);

    const vsCodeEdit = new vscode.TextEdit(editRange, edit.newText);

    return {
      label: `alias ${moduleName}`,
      filterText: moduleName,
      additionalTextEdits: [vsCodeEdit],
      insertText: parts.name,
    };
  }
}
