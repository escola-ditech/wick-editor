<h1 align="center">
  <br>
  <a href="https://editor.wickeditor.com/"><img src=".github/images/logo.svg" alt="Wick Editor" width="25%"></a>
  <br>
</h1>

<p align="center">
  <a href="https://github.com/Wicklets/wick-editor/issues">
      <img src="https://img.shields.io/badge/contributions-welcome-orange.svg"/>
  </a>
  <a href="https://www.patreon.com/WickEditor">
      <img src="https://img.shields.io/badge/$-donate-ff69b4.svg?maxAge=2592000&amp;style=flat"/>
  </a>
  <a href="LICENSE.md">
    <img src="https://img.shields.io/badge/License-GPLv3-blue.svg"/>
  </a>
  <a href="https://twitter.com/wickeditor?ref_src=twsrc%5Etfw">
    <img src="https://img.shields.io/twitter/follow/wickeditor?style=social&logo=twitter" alt="follow on Twitter"></a>
</p>

<h1>Wick Editor</h1>

The Wick Editor is a free and open-source tool for creating games, animations, and everything in-between. It's designed to be the most accessible tool for creating multimedia projects on the web.

<p align="center"><img width="100%" src=".github/images/editor.svg"></p>

## Getting started

These instructions work on Windows, MacOS and Linux.

### Requirements

You'll need to download the following:

- [Node.js](https://nodejs.org/) 26 or newer (includes npm)

### Installation

1) Clone this repository:

    ```bash
    git clone https://github.com/Wicklets/wick-editor/
    ```

2) Using the command line, change directories into the newly created `wick-editor` folder:

    ```bash
    cd wick-editor
    ```

3) Install all dependencies using this command:

    ```bash
    npm install
    ```

### Running the Editor

1) Run the editor with this command:

    ```bash
    npm start
    ```

2) Open a web browser and go to this URL:

    ```bash
    localhost:3000
    ```

Have fun hacking on Wick! 🎉

### Accounts (optional)

Signing in with Google and saving projects to the user's account uses Firebase. Without it, the editor still works and projects are saved and opened as files.

1) Create a Firebase project, register a Web app, enable the Google provider in Authentication and create a Firestore database.

2) Publish the rules in `firestore.rules` to the database.

3) Copy `.env.example` to `.env`, fill in the `VITE_FIREBASE_*` values and restart `npm start`. The `.env` file is not committed.

4) Recommended for a public site, so the database can only be used from it:
   - In the Google Cloud console (APIs & Services > Credentials), restrict the browser API key to the addresses of the site (HTTP referrers).
   - In the Firebase console, register the Web app in App Check with reCAPTCHA Enterprise, set the site key as `VITE_FIREBASE_APPCHECK_SITE_KEY` in `.env`, and once requests show up as verified, enforce App Check for Firestore.

### Running the tests

| Command | What it tests | Needs |
|---|---|---|
| `npm run lint` | Code style and common mistakes | |
| `npm test` | Editor | |
| `npm run test:cloud` | Saving projects to accounts and `firestore.rules`, on the Firestore emulator | Java |
| `npm run test:engine` | Wick Engine (`engine/tests`), in a headless browser | Chrome or Edge |
| `npm run test:smoke` | The built editor starts, draws, saves and opens its windows without errors (run `npm run build` first, or add `-- --dev` to test the development server) | Chrome or Edge |

Engine tests that are known to fail are listed in `scripts/engine-known-failures.json`.

### Building the engine

The editor loads the engine from `public/corelibs/wick-engine`. After changing anything in `engine/`, rebuild it with:

```bash
npm run build-engine
```

### Building for Production

```bash
npm run build
```

The site is generated in the `build` folder. `npm run preview` serves it locally.

The editor is built with [Vite](https://vite.dev/). Its configuration is in `vite.config.mjs`.

## Support

<a href="https://www.patreon.com/WickEditor">
	<img src="https://c5.patreon.com/external/logo/become_a_patron_button@2x.png" width="160">
</a>

## License

Wick Editor is under the GNU v3 Public License. See the [LICENSE](LICENSE.md) for more information.

## Links

* [Wick Editor Site](https://www.wickeditor.com)
* [Wick Editor Community Forum](https://forum.wickeditor.com/)
* [Follow on Twitter](https://twitter.com/wickeditor)
* [Follow on Facebook](https://www.facebook.com/wickeditor/)



## Support From

<a href="https://www.mozilla.org/en-US/moss/">
	<img src="https://www.wickeditor.com/static/media/mozilla.787ef555.svg" alt="Mozilla Open Source Support" height="100px"/>
</a>

<a href="https://studioforcreativeinquiry.org/frfaf-projects">
	<img src="https://www.wickeditor.com/static/media/studio.35c7a92e.svg" alt="Frank-Ratchye Fund for Art at the Frontier" height="100px"/>
</a>

<a href="https://www.du.edu/ahss/opensourcearts/">
	<img src="https://www.wickeditor.com/static/media/cosa_logo.9af883a9.png" alt="Clinic for Open Source Arts" height="100px"/>
</a>


## Testing Support From

<a href="https://www.browserstack.com/"><img src=".github/images/browserstack.svg" alt="Browser Stack" width="25%"></a>

