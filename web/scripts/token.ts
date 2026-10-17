// Creates an MCP token for a seed person or the team, and stores it in web/.env.seed.local
// (git-ignored) as MCP_TOKEN_<WHO>. Never printed. Run: npm run token -- lead|member|team
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Query } from "node-appwrite";
import { DB_ID, T, adminTables, assertOwnDatabase } from "../lib/appwrite";
import { createToken } from "../lib/tokens";

const EMAILS: Record<string, string> = { lead: "lead@beqa.commons.test", member: "member@beqa.commons.test" };
const FILE = ".env.seed.local";

async function main() {
  assertOwnDatabase();
  const who = process.argv[2];
  if (!who || !(who === "team" || who in EMAILS)) throw new Error("Usage: npm run token -- lead|member|team");

  let owner = "team";
  if (who !== "team") {
    const { rows } = await adminTables().listRows({
      databaseId: DB_ID,
      tableId: T.members,
      queries: [Query.equal("email", [EMAILS[who]]), Query.limit(1)],
    });
    if (!rows[0]) throw new Error(`No member ${EMAILS[who]}. Run npm run seed first.`);
    owner = rows[0].$id;
  }
  const { token } = await createToken(owner, `${who} (cli)`);

  const key = `MCP_TOKEN_${who.toUpperCase()}`;
  const lines = (existsSync(FILE) ? readFileSync(FILE, "utf8") : "").split("\n").filter((l) => l && !l.startsWith(`${key}=`));
  writeFileSync(FILE, [...lines, `${key}=${token}`].join("\n") + "\n");
  console.log(`token for ${who} saved as ${key} in web/${FILE}`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
