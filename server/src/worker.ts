// Cloudflare Workers entry. Bindings (DB, ALLOWED_ORIGINS) come from wrangler.toml.
import { createApp } from "./app.ts";

export default createApp();
