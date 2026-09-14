import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * The contract's source, byte for byte.
 *
 * The file in the repository is the file that is deployed: there is no build
 * step between them. `npm run match` compares these bytes with what the chain
 * returns for the deployed address. next.config.mjs traces the file into the
 * serverless bundle, which does not otherwise carry files it never imports.
 */
export const dynamic = "force-static";

export async function GET() {
  const source = await readFile(path.join(process.cwd(), "contracts", "standing.py"));
  return new Response(source, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
