#!/bin/sh
# Regenerate plugin/tests/fixtures.ts from the real CLI (run after `npm run build`).
set -e
cd "$(dirname "$0")/.."
DB=$(mktemp -d)/fx.db
B="plugin/bin/bookshop --db $DB"
T=$(mktemp -d)
$B --as user --json search --query gothic > $T/search.json
$B --as agent --json book gothic dracula > /dev/null
$B --as agent --json add > /dev/null
$B --as agent --json cart > /dev/null
$B --as agent --json checkout > /dev/null || true
$B --as user --json show > $T/with-proposal.json
$B --as user --json log 1 > $T/log-tail.json
$B --as user --json log --since 1 > $T/log-since.json
$B --as user --json open 2 > $T/open.json
$B --as user --json log --since 0 --actor user > $T/log-user.json
$B --as user --json book gothic frankenstein > $T/book.json
node -e '
const fs=require("fs"); const dir=process.argv[1]; const names=["search","with-proposal","open","log-tail","log-since","log-user","book"];
let out="// Real envelopes captured from bin/bookshop (see scripts/fixtures.sh). Do not edit by hand.\n";
for (const n of names) out+=`export const ${n.replace(/-(\w)/g,(_,c)=>c.toUpperCase())} = ${fs.readFileSync(dir+"/"+n+".json","utf8").trim()} as const\n`;
fs.writeFileSync("plugin/tests/fixtures.ts", out)' $T
echo "wrote plugin/tests/fixtures.ts"
