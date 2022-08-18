import assert from 'assert';
import {
  compareModuleNames,
  documentAlreadyHasAlias,
  documentDefinesModule,
  lineStartOffset,
  moduleNameFromAliasLine,
  positionForNewAliasLine,
} from '../../utils/document-analysis';

interface Example {
  input: any[];
  expectedOutput: any;
  only?: boolean;
}

function testExamples(fn: (...args: any[]) => any, examples: Example[]) {
  examples.forEach(({ input, expectedOutput, only }, idx) => {
    const testFn = only ? it.only : it;

    testFn(`example ${idx} works`, function () {
      const actualOutput = fn(...input);
      assert.equal(actualOutput, expectedOutput);
    });
  });
}

describe('documentDefinesModule', function () {
  const examples: Example[] = [
    {
      input: [
        'FooBar',
        `
					defmodule FooBar do
					end
				`,
      ],
      expectedOutput: true,
    },
    {
      input: [
        'Foo.Bar.Baz',
        `
				defmodule Foo.Bar.Baz do
				end
			`,
      ],
      expectedOutput: true,
    },
    {
      input: [
        'Foo.Bar.Baz',
        `
				defmodule Foo.Bar.Bin do
				end
			`,
      ],
      expectedOutput: false,
    },
  ];

  testExamples(documentDefinesModule, examples);
});

describe('documentAlreadyHasAlias', function () {
  const examples: Example[] = [
    {
      input: [
        'FooBar',
        '\n\t\tdefmodule A do\n\t\t\tuse Hello\n\n\t\t\timport Other\n\t\t\n\t\t\talias AndAnother\n\t\t\talias FooBar\n\t\t\talias Third\n\t\tend\n\t\t',
      ],
      expectedOutput: true,
    },
    {
      input: [
        'Foo.Bar',
        '\n\t\tdefmodule A do\n\t\t\talias Foo.Bar\n\t\tend\n\t\t',
      ],
      expectedOutput: true,
    },
    {
      input: [
        'Foo.Bar',
        '\n\t\tdefmodule A do\n\t\t\talias Foo.{Bar}\n\t\tend\n\t\t',
      ],
      expectedOutput: true,
    },
    {
      input: [
        'Foo.Bar',
        '\n\t\tdefmodule A do\n\t\t\talias Foo.{Bar, Baz}\n\t\tend\n\t\t',
      ],
      expectedOutput: true,
    },
    {
      input: [
        'Foo.Bar',
        '\n\t\tdefmodule A do\n\t\t\talias Foo.{Bin, Bar, Baz}\n\t\tend\n\t\t',
      ],
      expectedOutput: true,
    },
    {
      input: [
        'Foo.Bar.Baz',
        '\n\t\tdefmodule A do\n\t\t\talias Foo.Bar.{Baz, Bin, Bee}\n\t\tend\n\t\t',
      ],
      expectedOutput: true,
    },
    {
      input: [
        'Foo.Bar',
        '\n\t\tdefmodule A do\n\t\t\talias Foo.Baz\n\t\tend\n\t\t',
      ],
      expectedOutput: false,
    },
    {
      input: [
        'Foo.Bar',
        '\n\t\tdefmodule A do\n\t\t\talias Foo.{Bin, Baz}\n\t\tend\n\t\t',
      ],
      expectedOutput: false,
    },
    {
      input: [
        'Foo.Bar.Bin',
        '\n\t\tdefmodule A do\n\t\t\talias Foo.{Bar, Baz}\n\t\tend\n\t\t',
      ],
      expectedOutput: false,
    },
    {
      input: [
        'Foo.Bar.Baz.Bin',
        '\n\t\tdefmodule A do\n\t\t\talias Foo.{Bar, Baz}\n\t\tend\n\t\t',
      ],
      expectedOutput: false,
    },
  ];

  testExamples(documentAlreadyHasAlias, examples);
});

describe('compareModuleNames', function () {
  const examples: Example[] = [
    {
      input: ['Abc', 'Def'],
      expectedOutput: -1,
    },
    {
      input: ['Abc', 'Abc'],
      expectedOutput: 0,
    },
    {
      input: ['Def', 'Abc'],
      expectedOutput: 1,
    },
    {
      input: ['Abc.Def', 'Abc.Ghi'],
      expectedOutput: -1,
    },
    {
      input: ['Abc.Def', 'Def.Def'],
      expectedOutput: -1,
    },
    {
      input: ['Abc', 'AbcDef'],
      expectedOutput: -1,
    },
    {
      input: ['Abc.Def.{Bin, Boo}', 'Abc.Abc'],
      expectedOutput: 1,
    },
    {
      input: ['Abc.Def.{Bin, Boo}', 'Abc.Abc.{Baz, Foo}'],
      expectedOutput: 1,
    },
    {
      input: ['Abc.Def.{Bin, Boo}', 'Abc.Def'],
      expectedOutput: 1,
    },
  ];

  testExamples(compareModuleNames, examples);
});

describe('moduleNameFromAliasLine', function () {
  const examples: Example[] = [
    {
      input: ['alias Foo'],
      expectedOutput: 'Foo',
    },
    {
      input: ['    alias Foo.Bar.Baz'],
      expectedOutput: 'Foo.Bar.Baz',
    },
    {
      input: ['  alias Foo.Bar.{Baz, Bin, Bee}'],
      expectedOutput: 'Foo.Bar.{Baz, Bin, Bee}',
    },
  ];

  testExamples(moduleNameFromAliasLine, examples);
});

describe('lineStartOffset', function () {
  const examples: Example[] = [
    {
      input: ['abc'],
      expectedOutput: 0,
    },
    {
      input: ['    alias Foo.Bar.Baz'],
      expectedOutput: 4,
    },
    {
      input: ['  alias Foo.Bar.{Baz, Bin, Bee}'],
      expectedOutput: 2,
    },
  ];

  //

  testExamples(lineStartOffset, examples);
});

describe('positionForNewAliasLine', function () {
  interface Example {
    moduleName: string;
    text: string;
    expected: { line: number; char: number };
    only?: boolean; // If this is the only example that should run
  }

  const examples: Example[] = [
    {
      moduleName: 'Foo',
      text: `defmodule Abc do
end`,
      expected: { line: 1, char: 2 },
    },
    {
      moduleName: 'Foo',
      text: `defmodule Abc do
  use Abc, :thing
end`,
      expected: { line: 2, char: 2 },
    },
    {
      moduleName: 'Foo',
      text: `defmodule Abc do
  import Abc, only: [thing: 2]
end`,
      expected: { line: 2, char: 2 },
    },
    {
      moduleName: 'Foo',
      text: `defmodule Abc do
  alias Abc
end`,
      expected: { line: 2, char: 2 },
    },
    {
      moduleName: 'Foo',
      text: `defmodule Abc do
	use Whatever

	import Something
	import SomethingElse

  alias Abc
end`,
      expected: { line: 7, char: 2 },
    },
    {
      moduleName: 'Foo',
      text: `defmodule Abc do
	use Whatever

	import Something
	import SomethingElse

  alias Abc
  alias Def.G.{Hi, Jk}
	alias Ghi
	alias Xyz
end`,
      expected: { line: 8, char: 2 },
    },
  ];

  examples.forEach(({ moduleName, text, expected, only }, idx) => {
    const testFn = only ? it.only : it;

    testFn(`example ${idx}`, function () {
      const position = positionForNewAliasLine(moduleName, text);

      assert.equal(position.line, expected.line, 'Line matches');
      assert.equal(position.character, expected.char, 'Character matches');
    });
  });
});
