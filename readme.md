# Python Setup Guide for HKU Beginners

A beginner-friendly, static website that teaches new HKU postgraduate students how to
install a Python environment and run their first lessons. Content is written in
**Markdown** and rendered to HTML in the browser — no build step required.

## How it works (markdown-driven)

- Each HTML page is a thin **shell**. Its `<body>` carries `data-md="<file>.md"`.
- `assets/js/render.js` fetches that Markdown file, parses it with
  [`marked`](https://marked.js.org/) and sanitizes it with
  [`DOMPurify`](https://github.com/cure53/DOMPurify), then injects the HTML into the page.
- The top navigation, the index chapter cards, the sidebar table of contents, the
  Required/Optional/Skippable tag, and the Prev/Next pager are all generated automatically
  from `assets/js/site.js` and from each `.md` file's frontmatter.
- [TDesign web components](https://tdesign.tencent.com/web-components) are loaded via CDN
  and used for the chapter tag chips (`<t-tag>`). If the CDN is blocked, the page falls
  back to plain CSS — it still works. (shadcn requires React + a bundler, so it is not
  used in this no-build static site.)

### Editing content

1. Open the relevant `.md` file (`index.md` or `pages/<chapter>.md`).
2. Edit the text. Frontmatter at the top controls the page title and tag:
   ```markdown
   ---
   title: 3 · Installing Python
   tag: Required
   ---
   ```
3. Save and **refresh the browser** — the HTML updates instantly. No compilation.

### Markdown features supported

- Standard Markdown: headings, lists, tables, fenced code blocks, links, images.
- **Emoji callouts** become callouts: start a blockquote with `> 📝` (note), `> 💡` (tip),
  `> ⚠️` (warning), or `> ❗` (important). Do **not** use GitHub-style alert syntax
  (`> [!NOTE]` etc.), which only renders on GitHub.
- A standalone image `![alt](path)` is wrapped in a `<figure>` with the `alt` text as the
  caption. Use `assets/img/placeholder.svg` as a placeholder and replace `src` later.
- Shell code blocks (`bash`/`sh`/`zsh`/`powershell`/`cmd`) get colored `$` prompts and
  `#` comments automatically.
- Use `<!-- TODO: ... -->` comments in the Markdown for authoring notes (they are hidden
  when rendered).

### Adding a new chapter

1. Create `pages/<name>.md` with `title`/`tag` frontmatter.
2. Create `pages/<name>.html` copying any existing shell and setting
   `data-md="<name>.md"`.
3. Add an entry to `window.SITE.chapters` in `assets/js/site.js`
   (`{ name, n, title, tag, desc }`). The nav, index cards, and pager update automatically.

## Workflow: edit Markdown → refresh

The site is **markdown-driven**: each page `fetch()`es its `.md` and renders it in the
browser, so content is never compiled — it is read live. To see your edits, the browser
just needs to reload the `.md`.

### Option A — Auto-refresh while editing (recommended)

`serve.py` is a zero-dependency live-reload server. It watches every `.md`/`.html`/`.css`/
`.js` file and tells the browser to reload the moment you save:

```sh
python3 serve.py 8000
# edit any .md, save, and the page reloads automatically
```

No `pip install`, no bundler. The HTML served is still plain static files, so GitHub
Pages deployment is unchanged. (If you prefer Node tooling, `npx browser-sync start
--server --files "**/*"` does the same thing.)

### Option B — Manual refresh

You can use any static server; just refresh the browser after saving:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000/ and refresh after edits
```

> Why not open the `.html` directly? The browser blocks `fetch()` of local files over
> `file://`. Always serve over HTTP (either option above).

## Deploy to GitHub Pages

The site is plain static files — push to the repo and enable GitHub Pages on the branch
(root). No Jekyll or build step is needed. `marked`, `DOMPurify`, and TDesign are loaded
from jsDelivr, so the live site needs internet access for those scripts.

## Deploy your fork to Cloudflare Workers

This repository deploys as a static-assets-only Worker. Fork the repository, then in your
Cloudflare account create a Worker connected to your fork using the Cloudflare Workers &
Pages GitHub App. Set the build command to `npm run build` and the deploy command to
`npm run deploy`. The first deployment creates the `hku-entrepreneur-demo` Worker in your
own Cloudflare account; subsequent pushes to the connected branch deploy automatically.

Each student needs their own Cloudflare account and must authorize/install the Cloudflare
Workers & Pages GitHub App for their GitHub account. No Cloudflare API token is stored in
the repository. If you already have a Worker with this name in the same Cloudflare account,
change `name` in `wrangler.jsonc` before deploying.

## Container image for Azure Container Apps

The optional container deployment is independent of the Workers deployment and the GitHub
Pages workflow. In this upstream repository, the `Publish container to GHCR` workflow builds
a Linux/AMD64 image on pushes to `main` and `v*` tags. It can also be started manually from
the Actions tab. The default-branch image uses the `latest` tag; each build also gets a
commit-SHA tag. In a fork, automatic GHCR publishing is skipped; the fork owner can run the
workflow manually if they also want a container image.

The container runs as an unprivileged Nginx process on port `8080`. Use `/healthz` for an
HTTP health probe. For Azure Container Apps, set the ingress target port to `8080` and use
`ghcr.io/fyq163/hku-entrepreneur-demo:latest` as the image. GHCR packages are private by
default; configure Azure with a GitHub credential that has `read:packages`, or change the
package visibility in GitHub Packages if it should be public. Do not commit registry
credentials to this repository.

## Project status

See `AGENTS.md` for the full plan. Chapters are skeletons with placeholder text and TODO
markers; the structure, navigation, and Markdown rendering pipeline are complete.
