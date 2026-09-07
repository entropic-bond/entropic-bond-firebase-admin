# @entropic-bond/firebase-admin — Agent Guide

Firebase Admin plugins for Entropic Bond.

## Code format style

- Use tabsize of 2 spaces (VSCode setting) for indentation.
- Leave spaces around operators, e.g. `a + b`, ` => ` not `a+b`, '=>'.
- Use single quotes for strings, e.g. `'hello'` not `"hello"`.
- Use spaces after commas, e.g. `a, b` not `a,b`.
- Use spaces after colons, e.g. `a: b` not `a:b`.
- Use spaces after semicolons, e.g. `a; b` not `a;b`.
- Use spaces after start grouping tokens '({[' and before closing grouping tokens ')]})', e.g. `{ a }` not `{a}`, unless it's an empty object `{}` or array `[]` or followed by another grouping token'.

## Workflow

- When fixing a bug, improving a feature or creating a new feature, make sure to write tests to cover your changes first and work in TDD (Test-Driven Development) workflow. That means create a failing test before writing the code, write the code to make the test pass, and then refactor.
- When writing test, minimize the use non-existing mocks
