# Changelog

## [2.5.4](https://github.com/heavygee/agent-notify-tmux/compare/v2.5.3...v2.5.4) (2026-04-20)


### Bug Fixes

* **voice:** wrapper hardening, ALSA-first TTS, docs, deploy helpers ([429c15d](https://github.com/heavygee/agent-notify-tmux/commit/429c15d33209fcf54f60005a3bfc15287710f0b2))

## 2.5.1 (2026-01-31)


### Bug Fixes

* **codex:** insert notify config before sections to ensure global scope (e0c9db9)

## 2.5.0 (2026-01-31)


### Features

* **installer:** add automatic config backup before modification (68ee79a)

## 2.4.0 (2026-01-29)


### Features

* **platform:** add CLI notify command for general shell usage (821e477)

## 2.3.1 (2026-01-28)


### Bug Fixes

* **release:** compress binaries with tar.gz for smaller downloads (472cccb)

## 2.3.0 (2026-01-28)


### Features

* **cli:** add Cursor as independent platform (6f6a7d7)

## 2.2.0 (2026-01-28)


### Features

* **cli:** add config diff preview with confirmation before applying changes (138e64b)
* **install:** add curl install script and auto-configure Codex (c1dc0a9)

## 2.1.0 (2026-01-28)


### Features

* **install:** add curl install script to bypass macOS Gatekeeper (3835902)

## 2.0.0 (2026-01-28)


### ⚠ BREAKING CHANGES

* rename project to agent-notify

### Features

* **platform:** add OpenAI Codex notification support (be3ff97)
* rename project to agent-notify (1475e80)

## 1.3.0 (2026-01-28)


### Features

* **ntfy:** add ntfy push notification support with self-hosted docker setup (ccf1966)

## 1.2.0 (2026-01-28)


### Features

* **cli:** add feature toggles for sound, notification and voice (bc34e6c)

## 1.1.0 (2026-01-28)


### Features

* **scripts:** add macOS notification and voice announcement to generated scripts (9bf8280)
