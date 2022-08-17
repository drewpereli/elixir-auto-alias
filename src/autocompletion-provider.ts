import * as vscode from 'vscode';

export default class AutocompletionProvider
  implements vscode.CompletionItemProvider
{
  public provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Thenable<vscode.CompletionItem[]> {
    const items: vscode.CompletionItem[] = [
      { label: 'abcdefg' },
      { label: '123456789' },
    ];

    return Promise.resolve(items);
  }
}
