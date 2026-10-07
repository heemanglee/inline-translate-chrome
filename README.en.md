# Inline Translate for Chrome

[![한국어](https://img.shields.io/badge/lang-한국어-blue.svg)](README.md)
[![English](https://img.shields.io/badge/lang-English-red.svg)](README.en.md)

A Chrome extension that keeps the original English text intact and shows a Korean translation directly below each heading and paragraph.

It uses Chrome's built-in Translator API, so no subscription, account, API key, or external translation server is required. Chrome downloads the translation model on first use, and once it is ready, translation runs on your device.

![Korean translations shown below the English source text](docs/preview.png)

## Features

- Korean translations below English headings, paragraphs, lists, and tables
- Same font size as the source text
- Dark gray (`#424242`) translated text
- Toggle translations on and off from the right-click menu
- Running the action again during translation cancels the job and removes translations
- No duplicate translations for the same paragraph
- Blocks changed paragraphs and late-arriving translation responses
- Optional side panel for checking progress, stopping, and clearing

## Requirements

- Chrome 138 or later
- Desktop Chrome

Translator API and language pack availability may vary by Chrome version and environment.

## Installation

1. Clone or download this repository.

   ```bash
   git clone https://github.com/<username>/inline-translate-chrome.git
   ```

2. Open `chrome://extensions` in the Chrome address bar.
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked**.
5. Select the root folder of this repository. `manifest.json` should be directly inside it.
6. After modifying the extension, click the reload button on the extensions page and reload the target web page as well.

Do not move or delete the repository folder after installing it in Developer mode.

## Usage

On a regular web page, right-click and select **번역하기** (Translate).

- No translations yet: adds Korean translations below the source text.
- Already translated: removes the Korean translations.
- Translation in progress: cancels the job and removes any translations already shown.

The right-click action does not open the side panel.

When Chrome prepares the translation model for a site for the first time, it may require a user click. In that case, click **모델 준비 후 번역** (Prepare model and translate) once in the notice that appears at the bottom-right of the page.

Click the **문단 아래 한국어** icon in the toolbar to optionally open the side panel. The side panel lets you check translation progress, stop translation, and remove translations.

## Supported Content

The following text blocks are processed:

- Headings `h1`–`h6`
- Paragraphs
- List items
- Table cells and headers
- Blockquotes and captions
- Direct text in generic containers

The following content is not processed:

- Code and preformatted text
- Input and editable regions
- Navigation regions and hidden content
- `translate="no"` regions
- Text in images
- PDFs
- Content inside iframes
- Content inside Shadow DOM
- Chrome internal pages and the Chrome Web Store

Only text detected as English is translated. Other languages written mostly in Latin script may be detected as English, and paragraph splitting and translation placement may vary depending on the page structure. Up to 2,000 text blocks are processed at a time.

## Privacy and Permissions

The extension does not request persistent access to all sites.

| Permission | Purpose |
|---|---|
| `activeTab` | Temporary access to the current tab when you invoke the extension |
| `scripting` | Read page content and insert translations |
| `contextMenus` | Add **번역하기** (Translate) to the right-click menu |
| `sidePanel` | Show the optional translation control panel |

The extension includes no external translation servers, analytics SDKs, or remotely executed code. Source text and the translation cache are kept only in the memory of the current page or the open panel. Chrome manages language model download and execution.

## References

- [Chrome Translator API](https://developer.chrome.com/docs/ai/translator-api)
- [Built-in AI APIs](https://developer.chrome.com/docs/ai/built-in-apis)
- [activeTab permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [contextMenus API](https://developer.chrome.com/docs/extensions/reference/api/contextMenus)
- [sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
