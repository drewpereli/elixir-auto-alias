import * as vscode from 'vscode';

export default class AutocompletionProvider
  implements vscode.CompletionItemProvider
{
  constructor(private modules: string[]) {}

  public provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Thenable<vscode.CompletionItem[]> {
    const items: vscode.CompletionItem[] = this.modules.map((module) => ({
      label: module,
    }));

    return Promise.resolve(items);
  }
}
