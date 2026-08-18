# elxak.dev

Personal developer portfolio for **Elmurod Boboev** ([@ElXak](https://github.com/ElXak)) — a single self-contained `index.html`, no build step, no dependencies.

🔗 **Live:** [elxak.dev](https://elxak.dev) · [elxak.github.io](https://elxak.github.io)

## About

Full-stack developer based in Dushanbe, Tajikistan. This site covers:

- About / bio
- Tech stack
- Featured projects ([Cheat Sheets](https://cheatsheets.elxak.dev), [Baland Hotel](https://balandhotel.tj/))
- Contact links

Available in **Russian**, **English**, and **Tajik**, switchable at runtime with no page reload.

## Tech

Vanilla HTML/CSS/JS — no framework, no build tooling. All images (photos, banners, favicon) are embedded as base64 data URIs directly in `index.html`, so the whole site is one portable file.

## Running locally

Just open `index.html` in a browser — no server or build step required.

## Deployment

The site is deployed in two places from the same `index.html`:

- **GitHub Pages** — served directly from this repo.
- **Cloudflare Workers** (`elxak-dev`) — a static-assets mirror; see `tool/build-dist.js` and `wrangler.jsonc`.

## Contact

- Email: [contact@elxak.dev](mailto:contact@elxak.dev)
- Telegram: [@ElXak](https://t.me/ElXak)
- LinkedIn: [elmurod-boboev-27818951](https://linkedin.com/in/elmurod-boboev-27818951)
