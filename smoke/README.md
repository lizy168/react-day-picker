# v8 Release Smoke Apps

These minimal Vite apps test the packed `react-day-picker@8.10.2` tarball with
React 18 and React 19.

From the repository root:

```sh
corepack pnpm@8.6.2 build
npm pack --pack-destination smoke
```

Then run the React 18 smoke:

```sh
cd smoke/react18-vite
npm install
npm run build
npm run dev
```

Open http://127.0.0.1:5188/.

Then run the React 19 smoke:

```sh
cd smoke/react19-vite
npm install
npm run build
npm run dev
```

Open http://127.0.0.1:5189/.
