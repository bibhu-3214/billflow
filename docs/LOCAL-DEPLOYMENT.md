> Historical local-mode reference, retained from the pre-platform app. Current build commands and connected behavior are documented in README.md and api/README.md.

# Deploy the portfolio demo

## Netlify

The repository includes `netlify.toml` for a static deployment:

1. Import this repository in your Netlify account.
2. Select the branch containing these changes.
3. Keep build command `yarn build` and publish directory `build`.
4. Deploy. Node 22 and Yarn 1.22.22 are specified in the configuration; no OpenSSL compatibility option is required.
5. Open the resulting HTTPS URL, click **Explore live demo**, and reload `/admin` to verify the SPA rewrite.

No API keys or environment secrets are required. The rewrite sends client-side routes to `index.html`. Web Crypto requires HTTPS (localhost is also supported).

## Release checklist

- Run the quality checks from the README.
- Test sample entry, navigation, invoice creation and sign-out/reset.
- Confirm demo mutations do not alter an existing local account.
- Check desktop and mobile layouts and keyboard navigation.
- Review and resolve the KendoReact PDF missing-license warning before commercial distribution.
- Capture screenshots from the actual deployed UI with fictional sample data.
- Add the verified live URL to the repository About field and profile README.

A deployment configuration is not proof of a live deployment. Publish a link only after the hosted site has been checked.
