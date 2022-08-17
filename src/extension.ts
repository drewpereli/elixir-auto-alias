import * as vscode from 'vscode';
import AutocompletionProvider from './autocompletion-provider';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: 'elixir', scheme: 'file' },
      new AutocompletionProvider()
    )
  );
}

export function deactivate() {}
