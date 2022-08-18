interface SimplePosition {
  line: number;
  character: number;
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

  const moduleParts = moduleName.split('.');

  if (moduleParts.length < 2) {
    return false;
  }

  // Start by getting the prefix. If the moduleName "Foo.Bar.Baz", the prefix should be "Foo.Bar"
  const modulePrefix = moduleParts.slice(0, -1).join('.');

  // Create a regex to see if we have an alias of the form "alias Foo.Bar.{Baz, Bin}"
  // This part's a little weird. Since we're creating a regex from a string, we have to escape all the backslashes that should be in the regex
  // Bust basically the regex starts by looking for "alias ", then the module prefix,
  // then a "{", followed by a list of words separated by commas and spaces (i.e. the alias names), and then a "}".
  // The alias name list is captured in a group called aliasNames
  const regex = new RegExp(
    `alias\\s${modulePrefix.replace(
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

  // If the moduleName is "Foo.Bar.Baz", this will be "Baz"
  const moduleAliasName = moduleParts[moduleParts.length - 1];

  return aliasNames.includes(moduleAliasName);
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
