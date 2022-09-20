// Can be used to create a vscode.Position
interface SimplePosition {
  line: number;
  character: number;
}

// Can be used to create a vscode.TextEdit
interface SimpleTextEdit {
  start: SimplePosition;
  end?: SimplePosition; // Defaults to start
  newText: string;
}

export function documentDefinesModule(
  moduleName: string,
  text: string
): boolean {
  return text.includes(`defmodule ${moduleName} do`);
}

export function documentAlreadyHasAlias(
  moduleName: string,
  text: string
): boolean {
  // Say the moduleName is Foo.Bar.Baz
  // If the document already includes "alias Foo.Bar.Baz", return true
  if (text.includes(`alias ${moduleName}`)) {
    return true;
  }

  // Else, check if the document has something like "alias Foo.Bar.{Baz, Bin}"
  // This is only valid if the moduleName actually has multiple parts (i.e. periods)
  // because otherwise we know its false, since we know it can't be aliased using the bracket syntax

  const parts = moduleParts(moduleName);

  if (!parts.prefix) {
    return false;
  }

  // Create a regex to see if we have an alias of the form "alias Foo.Bar.{Baz, Bin}"
  // This part's a little weird. Since we're creating a regex from a string, we have to escape all the backslashes that should be in the regex
  // Bust basically the regex starts by looking for "alias ", then the module prefix,
  // then a "{", followed by a list of words separated by commas and spaces (i.e. the alias names), and then a "}".
  // The alias name list is captured in a group called aliasNames
  const regex = new RegExp(
    `alias\\s${parts.prefix.replace(
      /\./g,
      '\\.'
    )}\.{(?<aliasNames>(\\w+,?\\s?)+)}`
  );

  const match = text.match(regex);

  if (!match?.groups?.aliasNames) {
    return false;
  }

  // If the regex matched something like alias Foo.Bar.{Baz, Bin}, this will be ["Baz", "Bin"]
  const aliasNames = match.groups.aliasNames.split(', ');

  return aliasNames.includes(parts.name);
}

export function positionForNewAliasLine(
  moduleName: string,
  text: string
): SimplePosition {
  //   	If there are existing alias lines
  //			Get position of first line that has an alias that comes after moduleName in the alphabet
  //			If that's nil, just return the line after the last alias
  // 		else if there is an import statement
  // 			Position of line after last import statement
  //		else if there is a use statement
  //			Position of line after last use statement
  //		else
  // 			Position of line after defmodule statement

  const lines = text.split('\n').map((text, idx) => ({ text, idx }));

  const relevantLines = lines.filter((line) => {
    return (
      lineIsElixirDefModule(line.text) ||
      lineIsElixirUse(line.text) ||
      lineIsElixirImport(line.text) ||
      lineIsElixirAlias(line.text)
    );
  });

  const aliasLines = lines.filter((line) => lineIsElixirAlias(line.text));

  if (aliasLines.length > 0) {
    const firstLineAlphabeticallyAfter = aliasLines.find((line) => {
      const lineModuleName = moduleNameFromAliasLine(line.text);

      return compareModuleNames(moduleName, lineModuleName) == -1;
    });

    if (firstLineAlphabeticallyAfter) {
      return {
        line: firstLineAlphabeticallyAfter.idx,
        character: lineStartOffset(firstLineAlphabeticallyAfter.text),
      };
    }

    const lastAliasLine = aliasLines[aliasLines.length - 1];

    return {
      line: lastAliasLine.idx + 1,
      character: lineStartOffset(lastAliasLine.text),
    };
  }

  // The last line that is either a use, import, or defmodule
  const lastRelevantLine = lines.reverse().find((line) => {
    return (
      lineIsElixirDefModule(line.text) ||
      lineIsElixirUse(line.text) ||
      lineIsElixirImport(line.text)
    );
  });

  if (!lastRelevantLine) {
    return { line: 0, character: 0 };
  }

  // If we're putting the alias after a defmodule line, indent it by 2
  if (lineIsElixirDefModule(lastRelevantLine.text)) {
    return {
      line: lastRelevantLine.idx + 1,
      character: lineStartOffset(lastRelevantLine.text) + 2,
    };
  }

  return {
    line: lastRelevantLine.idx + 1,
    character: lineStartOffset(lastRelevantLine.text),
  };
}

function lineIsElixirDefModule(line: string) {
  return /^ *defmodule\s(\w|.)+ do/.test(line);
}

function lineIsElixirUse(line: string) {
  return /^ *use \w+/.test(line);
}

function lineIsElixirImport(line: string) {
  return /^ *import \w+/.test(line);
}

function lineIsElixirAlias(line: string) {
  return /^ *alias \w+/.test(line);
}

// Compares module names for sorting purposes
// -1 if a is before b, 0 if they're equal, 1 if a comes after b
export function compareModuleNames(a: string, b: string): -1 | 0 | 1 {
  if (a === b) return 0;

  const args = [a, b];

  const parts = args.map((arg) => arg.split('.'));

  const firsts = parts.map((p) => p[0]);

  if (firsts[0] === firsts[1]) {
    const remaining = parts.map((p) => p.slice(1).join('.'));

    return compareModuleNames(remaining[0], remaining[1]);
  }

  return firsts[0] < firsts[1] ? -1 : 1;
}

export function moduleNameFromAliasLine(line: string): string {
  const regex = /^ *alias (?<aliasName>.+)$/;
  const match = line.match(regex);

  if (!match?.groups?.aliasName) {
    throw new Error(`"${line}" not an alias`);
  }

  return match?.groups?.aliasName;
}

export function lineStartOffset(line: string): number {
  const match = line.match(/^\s*/);

  return match?.[0].length ?? 0;
}

export function textEditForForModule(
  moduleName: string,
  document: string
): SimpleTextEdit {
  //	Get module prefix
  //	If the module has a prefix and it's already aliased
  //		return text edit for adding module name to existing alias
  // else, return text edit for adding new alias

  const parts = moduleParts(moduleName);

  const lineToUpdate = lineOfUpdatableAlias(moduleName, document);

  if (lineToUpdate !== undefined) {
    const lineText = document.split('\n')[lineToUpdate];

    const newLineText = addAliasNameToLine(parts.name, lineText);

    return {
      start: { line: lineToUpdate, character: 0 },
      end: { line: lineToUpdate, character: lineText.length },
      newText: newLineText,
    };
  }

  return {
    start: positionForNewAliasLine(moduleName, document),
    newText: `alias ${moduleName}\n`,
  };
}

// e.g. if moduleName is Foo.Bar.Baz, will return {prefix: 'Foo.Bar', name: 'Baz'}
export function moduleParts(moduleName: string): {
  name: string;
  prefix?: string;
} {
  const parts = moduleName.split('.');

  const name = parts[parts.length - 1];

  if (parts.length < 2) {
    return {
      name,
    };
  }

  const prefix = parts.slice(0, -1).join('.');

  return { name, prefix };
}

// If there is an existing alias declaration in the document that we can multi-alias to add an alias of moduleName, will return the line number of that alias
// Otherwise return undefined
// Assumes the module is not already aliased in the document
// The tests should illustrate the use of this function
export function lineOfUpdatableAlias(
  moduleName: string,
  document: string
): number | undefined {
  const { prefix, name } = moduleParts(moduleName);

  if (!prefix) return;

  const escapedPrefix = prefix.replace(/\./g, '\\.');
  const regex = new RegExp(`^\\s*alias ${escapedPrefix}\\.(\\w+$|{)`);

  const lines = document.split('\n');

  const idx = lines.findIndex((line) => regex.test(line));

  return idx === -1 ? undefined : idx;
}

export function addAliasNameToLine(name: string, line: string): string {
  if (line.includes('{')) {
    const [pre, bracketed] = line.split(/(?={)/);

    const bracketedAliases = bracketed.trim().slice(1, -1).split(/, ?/);

    const newAliases = [...bracketedAliases, name].sort(compareModuleNames);

    return `${pre}{${newAliases.join(', ')}}`;
  }

  const parts = line.split('.');

  const currentName = parts.pop() as string;
  const pre = parts.join('.');

  const newAliases = [currentName, name].sort(compareModuleNames);

  return `${pre}.{${newAliases.join(', ')}}`;
}
