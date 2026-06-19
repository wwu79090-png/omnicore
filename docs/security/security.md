# OmniCore Security Log

This file records dependency and runtime security maintenance for OmniCore. Every security fix entry must include the vulnerability identifier, affected versions, fixed version, and the mitigation summary.

## Policy

- Run `npm run security-check` before every release branch.
- Use `npm run security-check -- --dry-run` in CI to avoid mutating lockfiles.
- Record all dependency or engine runtime vulnerabilities in this file.
- For emergency fixes, publish a patch release and add migration notes to `CHANGELOG.md`.

## Historical Vulnerabilities

| ID | Affected versions | Fixed version | Description | Status |
| --- | --- | --- | --- | --- |
| CVE-2026-OMNI-0001 | `<=0.1.0` sample maintenance baseline | `0.2.0` | Initial security policy added; no known runtime exploit in OmniCore core. Dependency audit is now automated through `scripts/security-check.js`. | Documented |

## Automated Check Template

Security automation appends entries below with npm-check-updates output, npm audit status before the fix, and npm audit status after the fix.

## 2026-06-18T07:16:30.401Z - automated security check

- Engine version: 0.1.0
- npm-check-updates: completed with warnings
- npm audit before fix: vulnerabilities or audit warnings detected
- npm audit fix: completed (dry-run)
- npm audit after fix: review required

<details><summary>npm-check-updates output</summary>

```text
spawn EINVAL
```
</details>

## 2026-06-18T07:17:50.096Z - automated security check

- Engine version: 0.1.0
- npm-check-updates: completed with warnings
- npm audit before fix: vulnerabilities or audit warnings detected
- npm audit fix: completed (dry-run)
- npm audit after fix: review required

<details><summary>npm-check-updates output</summary>

```text
spawn EINVAL
```
</details>

## 2026-06-18T10:01:31.589Z - automated security check

- Engine version: 0.1.0
- npm-check-updates: completed with warnings
- npm audit before fix: vulnerabilities or audit warnings detected
- npm audit fix: failed or no fix available
- npm audit after fix: review required

<details><summary>npm-check-updates output</summary>

```text
spawn EINVAL
```
</details>

## 2026-06-18T10:09:21.868Z - automated security check

- Engine version: 0.1.0
- npm-check-updates: completed
- npm audit before fix: no known vulnerabilities
- npm audit fix: completed (dry-run)
- npm audit after fix: no known vulnerabilities

<details><summary>npm-check-updates output</summary>

```text
Checking C:\Users\39120\Documents\引擎开发\package.json

Minor   Backwards-compatible features
 @babylonjs/core  ^9.12.1  →  ^9.13.0
 playwright       ^1.57.0  →  ^1.61.0
 prettier          ^3.6.2  →   ^3.8.4

Major   Potentially breaking API changes
 eslint             ^8.57.1  →  ^10.5.0
 jsdom              ^26.1.0  →  ^29.1.1
 npm-check-updates  ^18.3.1  →  ^22.2.3

Run npx npm-check-updates --format group -u to upgrade package.json
```
</details>

## 2026-06-18T10:13:32.893Z - automated security check

- Engine version: 0.1.0
- npm-check-updates: completed
- npm audit before fix: no known vulnerabilities
- npm audit fix: completed (dry-run)
- npm audit after fix: no known vulnerabilities

<details><summary>npm-check-updates output</summary>

```text
Checking C:\Users\39120\Documents\引擎开发\package.json

Minor   Backwards-compatible features
 @babylonjs/core  ^9.12.1  →  ^9.13.0
 playwright       ^1.57.0  →  ^1.61.0
 prettier          ^3.6.2  →   ^3.8.4

Major   Potentially breaking API changes
 eslint             ^8.57.1  →  ^10.5.0
 jsdom              ^26.1.0  →  ^29.1.1
 npm-check-updates  ^18.3.1  →  ^22.2.3

Run npx npm-check-updates --format group -u to upgrade package.json
```
</details>

## 2026-06-18T10:16:09.893Z - automated security check

- Engine version: 0.1.0
- npm-check-updates: completed
- npm audit before fix: no known vulnerabilities
- npm audit fix: completed (dry-run)
- npm audit after fix: no known vulnerabilities

<details><summary>npm-check-updates output</summary>

```text
Checking C:\Users\39120\Documents\引擎开发\package.json

Minor   Backwards-compatible features
 @babylonjs/core  ^9.12.1  →  ^9.13.0
 playwright       ^1.57.0  →  ^1.61.0
 prettier          ^3.6.2  →   ^3.8.4

Major   Potentially breaking API changes
 eslint             ^8.57.1  →  ^10.5.0
 jsdom              ^26.1.0  →  ^29.1.1
 npm-check-updates  ^18.3.1  →  ^22.2.3

Run npx npm-check-updates --format group -u to upgrade package.json
```
</details>

## 2026-06-18T10:17:58.072Z - automated security check

- Engine version: 0.1.0
- npm-check-updates: completed
- npm audit before fix: no known vulnerabilities
- npm audit fix: completed
- npm audit after fix: no known vulnerabilities

<details><summary>npm-check-updates output</summary>

```text
Checking C:\Users\39120\Documents\引擎开发\package.json

Minor   Backwards-compatible features
 @babylonjs/core  ^9.12.1  →  ^9.13.0
 playwright       ^1.57.0  →  ^1.61.0
 prettier          ^3.6.2  →   ^3.8.4

Major   Potentially breaking API changes
 eslint             ^8.57.1  →  ^10.5.0
 jsdom              ^26.1.0  →  ^29.1.1
 npm-check-updates  ^18.3.1  →  ^22.2.3

Run npx npm-check-updates --format group -u to upgrade package.json
```
</details>

## 2026-06-18T10:36:01.009Z - automated security check

- Engine version: 0.1.0
- npm-check-updates: completed
- npm audit before fix: no known vulnerabilities
- npm audit fix: completed (dry-run)
- npm audit after fix: no known vulnerabilities

<details><summary>npm-check-updates output</summary>

```text
Checking C:\Users\39120\Documents\引擎开发\package.json

Minor   Backwards-compatible features
 @babylonjs/core  ^9.12.1  →  ^9.13.0
 playwright       ^1.57.0  →  ^1.61.0
 prettier          ^3.6.2  →   ^3.8.4

Major   Potentially breaking API changes
 eslint             ^8.57.1  →  ^10.5.0
 jsdom              ^26.1.0  →  ^29.1.1
 npm-check-updates  ^18.3.1  →  ^22.2.3

Run npx npm-check-updates --format group -u to upgrade package.json
```
</details>

## 2026-06-18T10:40:15.228Z - automated security check

- Engine version: 0.1.0
- npm-check-updates: completed
- npm audit before fix: no known vulnerabilities
- npm audit fix: completed (dry-run)
- npm audit after fix: no known vulnerabilities

<details><summary>npm-check-updates output</summary>

```text
Checking C:\Users\39120\Documents\引擎开发\package.json

Minor   Backwards-compatible features
 @babylonjs/core  ^9.12.1  →  ^9.13.0
 playwright       ^1.57.0  →  ^1.61.0
 prettier          ^3.6.2  →   ^3.8.4

Major   Potentially breaking API changes
 eslint             ^8.57.1  →  ^10.5.0
 jsdom              ^26.1.0  →  ^29.1.1
 npm-check-updates  ^18.3.1  →  ^22.2.3

Run npx npm-check-updates --format group -u to upgrade package.json
```
</details>

## 2026-06-18T10:50:42.358Z - automated security check

- Engine version: 0.1.0
- npm-check-updates: completed
- npm audit before fix: no known vulnerabilities
- npm audit fix: completed (dry-run)
- npm audit after fix: no known vulnerabilities

<details><summary>npm-check-updates output</summary>

```text
Checking C:\Users\39120\Documents\引擎开发\package.json

Minor   Backwards-compatible features
 @babylonjs/core  ^9.12.1  →  ^9.13.0
 playwright       ^1.57.0  →  ^1.61.0
 prettier          ^3.6.2  →   ^3.8.4

Major   Potentially breaking API changes
 eslint             ^8.57.1  →  ^10.5.0
 jsdom              ^26.1.0  →  ^29.1.1
 npm-check-updates  ^18.3.1  →  ^22.2.3

Run npx npm-check-updates --format group -u to upgrade package.json
```
</details>

## 2026-06-19T08:49:41.604Z - automated security check

- Engine version: 0.1.0
- npm-check-updates: completed
- npm audit before fix: no known vulnerabilities
- npm audit fix: completed
- npm audit after fix: no known vulnerabilities

<details><summary>npm-check-updates output</summary>

```text
Checking C:\Users\39120\Documents\引擎开发\package.json

Minor   Backwards-compatible features
 playwright  ^1.57.0  →  ^1.61.0
 prettier     ^3.6.2  →   ^3.8.4

Major   Potentially breaking API changes
 eslint             ^8.57.1  →  ^10.5.0
 jsdom              ^26.1.0  →  ^29.1.1
 npm-check-updates  ^18.3.1  →  ^22.2.3

Run npx npm-check-updates --format group -u to upgrade package.json
```
</details>

## 2026-06-19T12:14:57.165Z - automated security check

- Engine version: 0.1.0
- npm-check-updates: completed
- npm audit before fix: no known vulnerabilities
- npm audit fix: completed
- npm audit after fix: no known vulnerabilities

<details><summary>npm-check-updates output</summary>

```text
Checking C:\Users\39120\Documents\引擎开发\package.json

Minor   Backwards-compatible features
 playwright  ^1.57.0  →  ^1.61.0
 prettier     ^3.6.2  →   ^3.8.4

Major   Potentially breaking API changes
 eslint             ^8.57.1  →  ^10.5.0
 jsdom              ^26.1.0  →  ^29.1.1
 npm-check-updates  ^18.3.1  →  ^22.2.3

Run npx npm-check-updates --format group -u to upgrade package.json
```
</details>
