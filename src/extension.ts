import * as vscode from 'vscode';
import AutocompletionProvider from './autocompletion-provider';
import { promises as fs } from 'fs';

export async function activate(context: vscode.ExtensionContext) {
  const modules = await getModules();

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: 'elixir', scheme: 'file' },
      new AutocompletionProvider(modules)
    )
  );
}

export function deactivate() {}

async function getModules(): Promise<string[]> {
  const files = await vscode.workspace.findFiles('**/*.ex', 'deps');

  const modules = await Promise.all(
    files.map((f) => getModuleNameFromFile(f.fsPath))
  );

  const presentModules: string[] = modules.filter(
    (m): m is string => typeof m === 'string'
  );

  return presentModules;
}

async function getModuleNameFromFile(
  file: string
): Promise<string | undefined> {
  const text = String(await fs.readFile(file));

  return text.match(/defmodule\s((\w|\.)+)/)?.[1];
}
