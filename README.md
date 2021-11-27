esmock
======
[![npm version](https://badge.fury.io/js/esmock.svg)](https://badge.fury.io/js/esmock) [![Build Status](https://github.com/iambumblehead/esmock/workflows/nodejs-ci/badge.svg)][2]

**esmock** provides simple, native ESM import mocking on a per-unit basis.

# Quick Start

To get started, simply install `esmock`, and update your test script to include it as a loader.

Note: **esmock _must_ be used with node's experimental --loader**

1. Install `esmock`:
```shell
$ npm i -D esmock
```
2. Update the `test` script in your `package.json`:
```json
{
  "type": "module",
  "scripts": {
    "test-ava": "ava --node-arguments=\"--loader=esmock\"",
    "test-mocha": "mocha --loader=esmock --no-warnings"
  }
}
```

# Mocking ESM Imports inside Unit Tests

Mocking is very simple and can be done on a per-unit basis. This means that each unit in your test file can be mocked differently, to allow for mocking out various scenarios.

The syntax is very simple:

```javascript
const targetModuleExports = await esmock(targetModule, childMocks, globalMocks)
```

- **`targetModule`**: The path to the module you'll be testing.
- **`targetModuleExports`**: Anything that `targetModule` exports.
- **`childMocks`**: Modules imported into `targetModule` that you want to mock.
- **`globalMocks`**: **_Optional_** Modules that you always want to mock, even if they're not directly imported by `targetModule`.

The `targetModuleExports` is the default export, or it can be destructured to retrieve named exports.
```javascript
// Grabbing the default export
const defaultExport = await esmock('../src/my-module.js', childMocks, globalMocks)
// Grabbing both the default export and a named export
const { default: defaultExport, namedExport } = await esmock('../src/my-module.js', childMocks, globalMocks)
```

The `*mocks` parameters follow the below syntax:
```javascript
childMocks | globalMocks = {
  'npm-pkg-name': {
    default: __mock_value__,
    namedExport: __mock_value__
  },
  '../relative/path/to/imported/file.js': {
    default: __mock_value__,
    namedExport: __mock_value__
  }
}
```

Where `__mock_value__` could be a `string`, `function`, `class`, or anything else, depending on the module/file you're importing in your target.

## Example

Here's an example that demonstrates mocking a named module, as well as a local JS file. In this example, we're testing the `./src/main.js` and mocking the modules and files that it imports.

**./src/main.js**:
```javascript
import serializer from 'serializepkg';
import someDefaultExport from './someModule.js';

export default () => {
  const json = serializer(someDefaultExport());
  return json;
}
```

**./tests/main.js**:
```javascript
test('should mock modules and local files at same time', async t => {
  const main = await esmock('../src/main.js', {
    serializepkg: {
      default: obj => JSON.stringify(obj)
    },
    '../src/someModule.js' : {
      default: () => ({ foo: 'bar' })
    }
  });

  // Because `serializepkg` is mocked as a function that calls JSON.stringify()
  // And `someDefaultExport` is mocked as a function that returns { foo: 'bar' }
  t.is(main(), JSON.stringify({ foo: 'bar' }));
});
```

## Example, mocking await import('modulename')

Before `esmock` returns a module, by default it deletes mocked definitions for that module. To use 'await import',  call `esmock.p( ... )` instead of `esmock( ... )` so that async imports may use mock definitions during test runtime and after the module is returned.

Foe example, let's test this file using `await import('eslint')`,
``` javascript
export default async function usesAwaitImport (config) {
  const eslint = await import('eslint');

  return new eslint.ESLint(config);
};
```

Use `esmock.p()` rather than `esmock()` to load that file,
``` javascript
test('should mock module using inline async import`', async t => {
  const usesAwaitImport = await esmock.p('./local/usesAwaitImport.mjs', {
    eslint : {
      ESLint : o => o
    }
  });

  t.is(await usesAwaitImport('config'), 'config');

  esmock.purge(usesAwaitImport); // esmock.purge clears the cache
});
```

If there are not many tests or if tests complete in separate processes, skipping `esmock.purge()` is OK (if you don't have hundreds of tests, its OK to skip)


### changelog

 * 1.3.0 _Nov.26.2021_
   * add support for await import, update README
 * 1.1.0 _Nov.25.2021_
   * add windows-latest to testing pipeline and begin windows support
   * removed files and functions no longer needed
   * increment resolvewithplus package and other dependencies
 * 1.0.1 _Nov.02.2021_
   * add node v17.x to testing pipeline
   * add, make warning message go away for node 16.12.0+
 * 1.0.0 _Oct.27.2021_
   * release version 1.0
 * 0.4.2 _Oct.27.2021_
   * export 'load' hook from moduleLoader, required by node v16.12.0+
 * 0.4.1 _Oct.10.2021_
   * version bump, increment devDependencies,
   * major improvement to README, thanks @swivelgames
 * 0.4.0 _Sep.07.2021_
   * do not runtime error when returning type '[object Module]' default
 * 0.3.9 _May.05.2021_
   * small change to README
   * added a test, update gitlab action to use node 16.x
 * 0.3.8 _Apr.21.2021_
   * small change to README
 * 0.3.7 _Apr.20.2021_
   * add test, throw error if mocked module path is not found
 * 0.3.6 _Apr.19.2021_
   * throw error if mocked module path is not found
 * 0.3.5 _Apr.18.2021_
   * added gitlab actions npm test: node 12.x, 14.x and 15.x
 * 0.3.3 _Apr.13.2021_
   * added keywords to package.json, use github action to npm publish
 * 0.3.1 _Apr.12.2021_
   * simplify README
 * 0.3.0 _Apr.10.2021_
   * adds support for mocking modules 'globally' for the instance
 * 0.2.0 _Apr.10.2021_
   * adds support for mocking core modules such as fs and path
 * 0.1.0 _Apr.10.2021_
   * adds support for native esm modules


[0]: http://www.bumblehead.com "bumblehead"
[1]: https://github.com/iambumblehead/esmock/workflows/nodejs-ci/badge.svg "nodejs-ci pipeline"
[2]: https://github.com/iambumblehead/esmock "esmock"
