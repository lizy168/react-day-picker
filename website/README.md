# DayPicker Website

The DayPicker website hosted at https://daypicker.dev is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

## Preview Deploys

The website build reads these optional environment variables:

- `SITE_URL`: the canonical site origin. Defaults to `https://daypicker.dev`.
- `BASE_URL`: the Docusaurus base path. Defaults to `/`.

For the prerelease preview site at `https://next.daypicker.dev`, build with:

```bash
SITE_URL=https://next.daypicker.dev BASE_URL=/ pnpm -F website build
```

Recommended Cloudflare Pages settings for the preview project:

- Production branch: `release/v10-next`
- Root directory: repository root
- Build command: `pnpm install --frozen-lockfile && pnpm build && pnpm -F website build`
- Output directory: `website/build`
- Environment variables: `SITE_URL=https://next.daypicker.dev`, `BASE_URL=/`

### Installation

```
$ npm
```

### Local Development

```
$ npm start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

### Build

```
$ npm build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.
