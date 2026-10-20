#!/bin/bash
# A scripted session: the user in the interactive terminal UI, Claude (the agent)
# calling the CLI, both on one database. Outputs go to demo-output/.
cd "$(dirname "$0")/.."
OUT="${OUT:-demo-output}"; mkdir -p "$OUT"; DB="$OUT/demo.db"; rm -f "$DB"*
B="plugin/bin/bookshop --db $DB"
A="$OUT/agent.out"; : > "$A"
agent() { echo "\$ bookshop --as agent $*" >> "$A"; $B --as agent "$@" >> "$A" 2>&1; echo "[exit $?]" >> "$A"; }
last_proposal() { $B --json pending | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).result.at(-1)?.id ?? ""))'; }

(
  echo search --query gothic; sleep 1.5
  echo follow agent; sleep 5
  echo "approve $(last_proposal)"; sleep 3
  echo "approve $(last_proposal)"; sleep 3
  echo unfollow; echo account; sleep 1; echo quit
) | $B --as user -i > "$OUT/user.out" 2>&1 &
UI=$!
sleep 1
agent peek user
agent search --query dystopia
agent open 1
agent add 2
agent add 99                                   # refused by the precheck: exit 4
agent do user.updateEmail --email gokhan@example.com   # proposal: exit 3
agent wait "$(last_proposal)" --timeout 20
agent cart
agent checkout                                 # proposal: exit 3
agent wait "$(last_proposal)" --timeout 20
agent checkout                                 # cart now empty: unavailable, exit 4
wait $UI
$B log 40 > "$OUT/log.txt"
echo "user: $OUT/user.out  agent: $OUT/agent.out  log: $OUT/log.txt"
