# Ciney AI — CineyBot & Tribot

Public static website for the CineyBot two-wheel and Tribot three-wheel camera robots.

## Website

GitHub Pages serves the `docs` folder on the `main` branch. The website includes:

- Homepage: `docs/index.html`
- CineyBot: `docs/two-wheel/index.html`
- Tribot: `docs/three-wheel/index.html`

The HTML, CSS, JavaScript, fonts, images and optimized videos are self-contained. No backend, API keys, build step or third-party runtime is required. Relative resource paths support both a repository subdirectory and a custom domain.

## Update

Edit the files in `docs` and push to `main`. GitHub Pages publishes the changes automatically. In repository **Settings → Pages**, the source should remain **Deploy from a branch → main → /docs**.

Run `node scripts/check.mjs` to check page navigation, media references and JavaScript syntax before publishing. The check verifies both root and repository-prefix hosting.

For a local preview, run `node scripts/preview.mjs`, then visit `http://127.0.0.1:4180/`.

Media retain the existing lazy loading, mobile variants and video controls. The Tribot structure film and chapter previews use the updated V02 portrait/landscape close-up.
