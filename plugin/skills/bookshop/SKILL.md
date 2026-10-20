---
name: bookshop
description: Use the bookshop with the user. Use whenever the user asks about books, their cart, orders or account, or refers to what they see in the bookshop pane.
---

# Using the bookshop

The bookshop is a CLI, `bookshop`, on your PATH. The user uses the same app in a pane (`/shop`). You and the user share one activity log, but you each have your own location, so browsing never moves the user's screen.

## Rules

1. **Always pass `--json`.** Every call prints one envelope: `ok`, `message`, `result`, `screen` (where you are now), `pending` (open proposals), `error`.
2. **Learn the app once per session:** `bookshop --json tools` lists every page with its params, every intent and every action with its input schema.
3. **Act from the screen.** `screen.intents` lists what you can do here, with `available` and `reason`. `screen.controls` lists every button, link and row the user sees, each with the exact `command` that performs it. Prefer these to guessing commands or URLs.
4. **Read facts from `screen.model`,** not from `screen.text`. The model holds computed values such as totals and checkout blockers.
5. **See what the user sees before acting on "this" or "here":** `bookshop --json peek user`.
6. **Exit code 3 means proposed, not done.** Some actions (changing the email, placing an order) need the user's approval when you ask. Tell the user what you proposed and its id, then `bookshop wait <id>`. Never retry or rephrase a proposal to get around approval.
7. **Test before proposing** when unsure: `bookshop --json do <action> --check …` validates and runs the precheck without writing anything.

## Commands

- Pages, with params as flags: `bookshop --json search --query dune`, `bookshop --json book 4`, `bookshop --json cart`, `account`, `activity`
- Intents on the current page: `open 2`, `next`, `prev`, `sort price`, `genre gothic`, `add 2`, `more`, `remove 1`, `checkout`, `email a@b.co`
- Anywhere: `go <href>`, `back`, `forward`, `set k=v`, `unset k`, `reload`, `show`, `do <action> --k v`, `pending`, `wait <id>`, `peek user`, `log [n]`

## Exit codes

0 done · 1 bad input · 2 not found · 3 proposed, waiting for approval · 4 refused (unavailable or precheck failed) · 5 timed out · 6 not allowed · 70 bug

## Example

```
bookshop --json peek user             # user is on /books/5 (Frankenstein)
bookshop --json book 5                # go there yourself
bookshop --json add 2                 # result.status "applied"
bookshop --json cart                  # screen.model.total, screen.model.blockers
bookshop --json checkout              # exit 3: proposed #12
# tell the user: "I've proposed placing the order (#12, £17.97). Approve it in the pane."
bookshop wait 12 --timeout 300        # exit 0 once approved, 4 if rejected
```
