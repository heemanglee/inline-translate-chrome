# AGENTS.md

## Project overview

This repository contains a Manifest V3 Chrome extension that keeps English source text visible and inserts Korean translations immediately below it.

The extension uses Chrome's built-in Translator API. Do not add subscriptions, API keys, remote translation services, analytics SDKs, or remote executable code.

Chrome 138 or newer is the minimum supported version.

## User-facing behavior

Preserve these contracts unless the user explicitly requests a change:

- The page context menu contains **번역하기** on ordinary HTTP and HTTPS pages.
- Right-click **번역하기** does not open the side panel.
- If the page is untranslated, the context-menu action starts translation automatically.
- If translations exist or translation is in progress, the same action cancels the work and removes translations.
- The toolbar action may open the optional side panel for progress, stop, clear, and restart controls.
- English source text must remain unchanged.
- Korean text appears directly below the corresponding source block.
- Korean text uses the source block's computed font size.
- Korean text uses dark gray `#424242`.
- Do not add a vertical bar, border, or indentation before translated text.
- Do not insert duplicate translations.
- A late translation response must never restore text after cancel or clear.

## Architecture

- `manifest.json`: extension metadata, minimum Chrome version, permissions, background worker, side panel, and icons.
- `background.js`: toolbar action, context-menu registration, document capture, and per-tab toggle ordering.
- `content.js`: source extraction, page-owned translation flow, DOM insertion, cancellation, clearing, and stale-response protection.
- `engine.mjs`: canonical `TranslationEngine` and long-text chunking implementation.
- `engine-content.js`: generated content-script version of `engine.mjs`.
- `build.mjs`: generates `engine-content.js` from `engine.mjs`.
- `panel.html`, `panel.css`, `panel.mjs`: optional side-panel UI and its translation flow.
- `icons/`: packaged extension icons.
- `VALIDATION.md`: recorded verification evidence and known validation limits.

`engine.mjs` is the source of truth. Never edit `engine-content.js` by hand. After changing `engine.mjs`, run:

```bash
node build.mjs
```

Commit the regenerated `engine-content.js` together with the source change.

## Permissions and privacy

Keep permissions narrowly scoped. The expected permissions are:

- `activeTab`
- `scripting`
- `contextMenus`
- `sidePanel`

Do not add `host_permissions`, `<all_urls>`, storage, telemetry, cookies, web-request access, or external network access without an explicit requirement and a documented reason.

Translation input must not be persisted. The current design keeps source text and translation caches only in page or side-panel memory. Chrome manages model download and execution.

## DOM safety

- Treat page content and translated output as untrusted text.
- Render translation results with `textContent`; never insert translated output with `innerHTML`.
- Keep extension state in the isolated content-script world.
- Mark extension-owned DOM with the extension ID and remove only nodes owned by this extension.
- Preserve source elements, links, formatting, lists, and tables.
- Exclude code, form controls, editable regions, navigation, hidden content, and `translate="no"` subtrees.
- Do not traverse or modify iframes or page Shadow DOM unless support is explicitly designed and reviewed.

## Async and lifecycle invariants

- Capture the target `documentId` when the user invokes the extension and send later messages to that document.
- Preserve context-menu action order per tab, including when script injection resolves out of order.
- Use job identity and cancellation state to reject stale work.
- Check cancellation before and after every awaited translation.
- Clear pending jobs, notices, translation hosts, and block records together.
- Navigation, reload, extension restart, stop, and clear must not leave a path for a late response to reinsert translations.
- When the Translator API requires transient user activation, request one page-local click and retain the original translation target.

## Context-menu flow

The context-menu handler must remain panel-independent:

1. Capture the clicked tab and document immediately.
2. Inject `engine-content.js` and `content.js` into the main frame's isolated world.
3. Send `TOGGLE` to the captured `documentId`.
4. Do not select the currently active tab again after asynchronous work begins.
5. Do not open the side panel from this flow.

## Coding conventions

- Use plain JavaScript and browser APIs. The runtime extension has no npm dependencies or bundler.
- Keep Korean and other non-ASCII strings as literal UTF-8. Never use `\uXXXX` escapes for user-facing Korean.
- Prefer small functions with one responsibility.
- Avoid implicit fallbacks that send data to another service.
- Surface actionable errors to the user and retain the original error text where it helps diagnosis.
- Update `manifest.json` version when producing a user-installable behavior change.
- Update `README.md` and `VALIDATION.md` when behavior, permissions, installation, or support limits change.

## Verification

At minimum, run JavaScript syntax checks after changes:

```bash
node --check background.js
node --check content.js
node --check panel.mjs
node --check engine.mjs
node --check engine-content.js
node --check build.mjs
```

After editing the translation engine, regenerate the content version and confirm it matches the source:

```bash
node build.mjs
git diff --check
```

For behavior changes, verify the relevant cases in desktop Chrome:

- first context-menu action translates without opening a panel;
- second context-menu action removes translations;
- invoking the action during translation cancels and clears it;
- title, paragraph, list, and table translations match the source font size;
- translations render in `#424242` without a left border;
- navigation or clear prevents late results from appearing;
- first-use model preparation works through the page-local action;
- restricted pages fail with a clear message and no external fallback.

Record material verification evidence and known gaps in `VALIDATION.md`.

## Git workflow

- Preserve unrelated user changes.
- Do not commit, push, publish, or install the extension unless the user explicitly asks.
- Do not include generated archives or temporary test artifacts unless requested.
- When Codex creates a commit, append this git trailer after a blank line:

```text
Co-Authored-By: Codex <noreply@openai.com>
```

- Do not add that trailer to commits authored directly by the user.
