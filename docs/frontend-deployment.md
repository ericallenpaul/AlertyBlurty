# Frontend Deployment

AlertyBlurty ships the React frontend as a separate static artifact.

## Hosting Model

Use `src/alertblurty.Web/dist` as a static web artifact served by Nginx, a CDN, object storage static hosting, or another static file host. Keep the ASP.NET Core API deployed separately from the frontend.

This keeps API and UI releases independently deployable and avoids coupling static asset hosting back into the API process.

## Build

Set `VITE_API_BASE_URL` to the externally reachable API origin before building:

```bash
cd src/alertblurty.Web
VITE_API_BASE_URL=https://api.example.com npm ci
VITE_API_BASE_URL=https://api.example.com npm run build
```

The output is written to:

```text
src/alertblurty.Web/dist
```

## Static Host Requirements

- Serve `index.html` for unknown routes so React Router can handle deep links such as `/dashboard` and `/incidents/{id}`.
- Serve files under `dist/assets` with long-lived cache headers when possible.
- Serve `index.html` with a short cache lifetime.
- Configure TLS at the static host or reverse proxy.
- Configure the API CORS policy for the frontend origin when the API and frontend use different origins.

## Release Artifact

The release workflow uploads:

- `alertblurty-api-${{ github.ref_name }}` from the published ASP.NET Core API.
- `alertblurty-web-${{ github.ref_name }}` from `src/alertblurty.Web/dist`.

Deploy the web artifact to the static host and the API artifact to the API host for the same release tag.
