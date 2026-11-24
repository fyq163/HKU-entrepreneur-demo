# Python Setup Guide for HKU Beginners

A beginner-friendly site for new HKU postgraduate students learning to set up Python and run their first lessons.

> **Disclaimer:** This repository is an educational demo, not a confidential or anonymous counseling service. Names and messages are public. Email addresses are stored in Cloudflare D1 and can be accessed by the site maintainer, although they are not displayed on the public board. Do not post sensitive, confidential, or emergency information.

## Deploy to Cloudflare Workers

This repository is a Cloudflare Worker with static assets and a D1-backed Message Board. Each browser session can publish one message and edit that same entry. The public board shows the author's name, message, and date, but never the email address. Clearing the browser's session cookie creates a new session and therefore a new entry.

### Prepare your fork and D1 database

1. Fork this repository and clone your fork. Install the pinned Wrangler dependency:

   ```sh
   npm ci
   ```

2. Sign in to your own Cloudflare account and create a D1 database:

   ```sh
   npx wrangler login
   npx wrangler d1 create hku-message-board
   ```

3. Copy the `database_id` returned by Wrangler into `wrangler.jsonc`, replacing the all-zero placeholder. Keep `database_name` as `hku-message-board`, or update both the configuration and commands if you choose another name.

4. Apply the schema to your remote database:

   ```sh
   npm run d1:migrate:remote
   ```

Each student must create and use a D1 database in their own Cloudflare account. Do not reuse another person's database ID. The migration creates one row per hashed browser-session cookie, with a database primary key that prevents that session from creating a second row.

### Connect the fork to Workers Builds

In the Cloudflare dashboard, go to **Workers & Pages → Create application → GitHub**, authorize the Cloudflare Workers & Pages GitHub App, and select your fork. Set the production branch to `main`, the build command to `npm run build`, and the deploy command to `npm run deploy`. The Worker name must match `name` in `wrangler.jsonc`, which defaults to `hku-entrepreneur-demo`. Rename it if that name is already used in your Cloudflare account. Turn off preview builds if you want only `main` builds to run.

After the first deployment, pushes to `main` deploy the production Worker. Cloudflare manages the deployment authorization for Workers Builds; no Cloudflare API token is stored in this repository. For local development, run:

```sh
npm run build
npm run d1:migrate:local
npm run dev
```

The Message Board depends on the Worker API and D1 binding. It is available on the Cloudflare Workers deployment; the static GitHub Pages site and the Nginx-only Azure container image do not provide that D1 API.

## Container image for Azure Container Apps

The optional container path is independent of Workers. The GHCR publishing workflow listens only for pushes to `main` and only publishes from the upstream repository. Development-branch pushes and fork pushes do not publish automatically. It builds a Linux/AMD64 image at `ghcr.io/fyq163/hku-entrepreneur-demo`; the default-branch image is tagged `latest`, `main`, and with the commit SHA.

The Nginx container listens on port `8080`; use `/healthz` for an HTTP health probe and set the Azure Container Apps ingress target port to `8080`. GHCR packages are private by default, so configure Azure with a GitHub credential that has `read:packages`, or change the package visibility in GitHub Packages. Do not commit registry credentials to this repository.

## How the site works

- The tutorial pages use Markdown files rendered in the browser. Each page shell points to its content file, while the navigation, chapter cards, table of contents, and previous/next links are generated from `assets/js/site.js`.
- `marked` parses Markdown and `DOMPurify` sanitizes the result. TDesign web components are loaded from a CDN for optional tag styling; the site remains usable if that CDN is unavailable.
- The Message Board is a separate English-language page. Its Worker API validates submissions, stores messages in D1, and returns only names and messages to the public list. Email addresses are returned only to the matching browser session for editing.

## Editing content

1. Edit `index.md` or a chapter file such as `pages/installation.md`.
2. Frontmatter at the top of a chapter controls its title and tag:

   ```markdown
   ---
   title: 3 · Installing Python
   tag: Required
   ---
   ```

3. Save and refresh the browser. The Markdown content updates without a compilation step.

## Markdown features supported

- Standard Markdown: headings, lists, tables, fenced code blocks, links, and images.
- Start a blockquote with `> 📝`, `> 💡`, `> ⚠️`, or `> ❗` for note, tip, warning, or important callouts. GitHub-style alert syntax such as `> [!NOTE]` is not used in the reader-facing pages.
- A standalone image `![alt](path)` is wrapped in a figure with the alt text as its caption. Use `assets/img/placeholder.svg` as a placeholder.
- Shell code blocks (`bash`, `sh`, `zsh`, `powershell`, and `cmd`) receive colored prompts and comments.
- Use HTML comments such as `<!-- TODO: ... -->` for authoring notes that should not appear on the page.

## Adding a tutorial chapter

1. Create `pages/<name>.md` with `title` and `tag` frontmatter.
2. Create `pages/<name>.html` from an existing page shell and set `data-md="<name>.md"`.
3. Add the chapter to `window.SITE.chapters` in `assets/js/site.js`. The home cards, navigation, and pager update automatically.

## Local preview

For automatic refresh while editing, run:

```sh
python3 serve.py 8000
```

You can also use Python's built-in static server for a manual-refresh preview:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/`. Do not open the HTML file directly because the browser blocks Markdown `fetch()` requests from `file://` URLs.

## Project status

See `AGENTS.md` for the project plan. The tutorial structure, navigation, and Markdown rendering pipeline are in place; some tutorial chapters still contain skeleton content and TODO markers.

## Deploy to GitHub Pages

GitHub Pages remains a legacy static-only option. It serves the repository files but does not run the Worker API or provide the D1-backed Message Board. For the complete site, use the Cloudflare Workers deployment described at the top of this README.
