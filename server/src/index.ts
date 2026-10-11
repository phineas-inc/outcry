import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { openNodeDb } from "./db.ts";

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: createApp({ db: openNodeDb() }).fetch, port }, () => console.log(`Outcry API listening on :${port}`));
