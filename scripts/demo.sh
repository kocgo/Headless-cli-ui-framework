#!/bin/bash
cd "$(dirname "$0")/.."
S="${S:-demo-output}"; mkdir -p "$S"; export BOOKSHOP_DB="$S/demo.db"; rm -f "$BOOKSHOP_DB"*
B="npx tsx --conditions=development --no-warnings=ExperimentalWarning src/cli.ts"
pid_of_pending() { $B --json pending | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).result;console.log(r.at(-1)?.id??"")})'; }
A="$S/agent.out"; : > $A
agent() { echo "\$ bookshop --as agent $*" >> $A; $B --as agent "$@" >> $A 2>&1; echo "[exit $?]" >> $A; }

# user's terminal UI, fed by a timed script
(
  echo cart; sleep 2
  echo "follow agent"; sleep 6
  ID=$(pid_of_pending); echo "approve $ID"; sleep 4
  ID=$(pid_of_pending); echo "reject $ID not yet, I'm still browsing"; sleep 3
  echo unfollow; sleep 4
  sleep 2; echo quit
) | $B -i > $S/user.out 2>&1 &
UI=$!
sleep 1.5
agent search gothic
sleep 1
agent open 2                       # user is following: their screen moves too
agent add                          # mutation: user's cart badge updates
agent do user.updateEmail --email gokhan@example.com   # needs approval → proposal
$B --as agent wait $(pid_of_pending) --timeout 20 > $S/wait1.out 2>&1 &
sleep 4
cat $S/wait1.out >> $A
agent cart
agent checkout                     # proposal; user rejects it
sleep 4
agent peek user                    # what is the user looking at?
$B account > /dev/null             # user acts from ANOTHER terminal: TUI jumps
sleep 2
agent --json peek user
wait $UI
echo "user terminal: $S/user.out   agent calls: $S/agent.out"
