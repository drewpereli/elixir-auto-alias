import assert from 'assert';
import dedent from 'dedent-js';
import {
  compareModuleNames,
  documentAlreadyHasAlias,
  documentDefinesModule,
  lineStartOffset,
  moduleNameFromAliasLine,
  moduleParts,
  positionForNewAliasLine,
  textEditForForModule,
  lineOfUpdatableAlias,
  addAliasNameToLine,
} from '../../utils/document-analysis';

interface Example<F extends (...args: any[]) => any> {
  input: Parameters<F>;
  expectedOutput: ReturnType<F>;
  label?: string;
  only?: boolean;
}

function testExamples<F extends (...args: any[]) => any>(
  fn: F,
  examples: Example<F>[]
) {
  examples.forEach(({ input, expectedOutput, only, label }, idx) => {
    const testFn = only ? it.only : it;

    testFn(label ?? `example ${idx} works`, function () {
      const actualOutput = fn(...input);
      assert.deepEqual(actualOutput, expectedOutput);
    });
  });
}

describe('documentDefinesModule', function () {
  const examples: Example<typeof documentDefinesModule>[] = [
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
  const examples: Example<typeof documentAlreadyHasAlias>[] = [
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
  const examples: Example<typeof compareModuleNames>[] = [
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
  const examples: Example<typeof moduleNameFromAliasLine>[] = [
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
  const examples: Example<typeof lineStartOffset>[] = [
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
  const examples = [
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
    {
      moduleName: 'Foo',
      text: dedent`
        defmodule Abc do
          alias Abc
          alias Xyx
        end
      `,
      expected: {
        line: 2,
        char: 2,
      },
    },
  ];

  examples.forEach(({ moduleName, text, expected }, idx) => {
    it(`example ${idx}`, function () {
      const position = positionForNewAliasLine(moduleName, text);

      assert.equal(position.line, expected.line, 'Line matches');
      assert.equal(position.character, expected.char, 'Character matches');
    });
  });
});

describe('modulePrefix', function () {
  testExamples(moduleParts, [
    {
      input: ['Foo.Bar.Baz'],
      expectedOutput: { name: 'Baz', prefix: 'Foo.Bar' },
    },
    { input: ['Foo'], expectedOutput: { name: 'Foo' } },
  ]);
});

describe('textEditForForModule', function () {
  testExamples(textEditForForModule, [
    {
      input: [
        'Foo',
        dedent`
					defmodule Abc do
					end	
				`,
      ],
      expectedOutput: {
        start: { line: 1, character: 2 },
        newText: 'alias Foo',
      },
    },
    {
      input: [
        'Foo',
        dedent`
					defmodule Abc do
					  alias Abc
					  alias Xyx
					end
				`,
      ],
      expectedOutput: {
        start: { line: 2, character: 2 },
        newText: 'alias Foo',
      },
    },
    {
      input: [
        'Foo.Bar.Baz',
        dedent`
					defmodule Abc do
					  alias Foo.Bar.{Abc, Xyz}
					end
				`,
      ],
      expectedOutput: {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 26 },
        newText: '  alias Foo.Bar.{Abc, Baz, Xyz}',
      },
    },
    {
      input: [
        'Foo.Bar.Def',
        dedent`
          defmodule Abc do
            alias Foo.Bar.{Aaa, Bbb}
          end
        `,
      ],
      expectedOutput: {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 26 },
        newText: '  alias Foo.Bar.{Aaa, Bbb, Def}',
      },
    },
    {
      input: [
        'Foo.Bar.Baz',
        dedent`
          defmodule Abc do
            alias Foo.Bar.{Qrs, X}
          end
        `,
      ],
      expectedOutput: {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 24 },
        newText: '  alias Foo.Bar.{Baz, Qrs, X}',
      },
    },
    {
      input: [
        'Foo.Bar.Baz',
        dedent`
          defmodule Abc do
                alias Foo.Bar.{Qrs, X}
          end
        `,
      ],
      expectedOutput: {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 28 },
        newText: '      alias Foo.Bar.{Baz, Qrs, X}',
      },
    },
  ]);
});

describe('lineOfUpdatableAlias', function () {
  testExamples(lineOfUpdatableAlias, [
    {
      input: [
        'Foo.Baz',
        dedent`
					defmodule Abc do
						alias Foo.Bar
					end
				`,
      ],
      expectedOutput: 1,
      label: 'returns the line number when there is a simple existing alias',
    },
    {
      input: [
        'Foo.Baz',
        dedent`
					defmodule Abc do
						import Foo
						import Foo.Bar
					
						alias Abc.Def
						alias Foo
						alias Foo.Bar.Baz.Bin
						alias Foo.Bar
						alias Foo.Bar.Abc.Bin
					end
				`,
      ],
      expectedOutput: 7,
      label:
        'returns the correct line number when there are multiple aliases and other statements',
    },
    {
      input: [
        'Foo.Bin',
        dedent`
				defmodule Abc do
				import Foo
				import Foo.Bar
			
				alias Abc.Def
				alias Foo
				alias Foo.Bar.Baz.Bin
				alias Foo.{Bar, Baz}
				alias Foo.Bar.Abc.Bin
			end
				`,
      ],
      expectedOutput: 7,
      label:
        'returns the line number when there is an existing alias using bracket syntax',
    },
    {
      input: [
        'Foo.Bar.Bin',
        dedent`
					defmodule Abc do
						alias Foo.Bar.Baz
					end
				`,
      ],
      expectedOutput: 1,
    },
    {
      input: [
        'Foo.Bar',
        dedent`
					defmodule Abc do
						alias Foo.Bar.Bin
					end
				`,
      ],
      expectedOutput: undefined,
      label:
        "returns undefined when the module is aliased but has it's aliasing a submodule",
    },
    {
      input: [
        'Foo.Bar',
        dedent`
					defmodule Abc do
						alias Foo.Bar.{Baz, Bin}
					end
				`,
      ],
      expectedOutput: undefined,
      label:
        'returns undefined when the module is aliased but has brackets after',
    },
    {
      input: [
        'Foo.Bar',
        dedent`
					defmodule Abc do
					end
				`,
      ],
      expectedOutput: undefined,
      label: 'returns undefined when the module prefix is not aliased',
    },
    {
      input: [
        'Foo',
        dedent`
					defmodule Abc do
					end
				`,
      ],
      expectedOutput: undefined,
      label: "returns undefined when the module doesn't have a prefix",
    },
  ]);
});

describe('addAliasNameToLine', function () {
  testExamples(addAliasNameToLine, [
    {
      input: ['Abc', 'alias Foo.Bar'],
      expectedOutput: 'alias Foo.{Abc, Bar}',
    },
    {
      input: ['Abc', 'alias Foo.{Bar, Bin}'],
      expectedOutput: 'alias Foo.{Abc, Bar, Bin}',
    },
    {
      input: ['Def', 'alias Foo.{Bar, Xyz}'],
      expectedOutput: 'alias Foo.{Bar, Def, Xyz}',
    },
    {
      input: ['Xyz', 'alias Foo.{Bar, Def}'],
      expectedOutput: 'alias Foo.{Bar, Def, Xyz}',
    },
    {
      input: ['Xyz', '    alias Foo.{Bar, Def}'],
      expectedOutput: '    alias Foo.{Bar, Def, Xyz}',
    },
    {
      input: ['Baz', '  alias Foo.Bar.{Abc, Xyz}'],
      expectedOutput: '  alias Foo.Bar.{Abc, Baz, Xyz}',
    },
  ]);
});
