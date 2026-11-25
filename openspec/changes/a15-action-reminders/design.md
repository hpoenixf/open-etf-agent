# Design

The existing research CLI parser routes reminder commands to one SQLite file in the explicitly selected local directory. Due instants are normalized to UTC. List and due are read-only and never initialize the store. Atomic transactions serialize simultaneous writers.

A stable reminder ID and occurrence number identify the current due instance. Defer requires a later time and moves the item to a new pending occurrence. An older command cannot mark, defer or acknowledge the new occurrence. Display is an explicit operator-recorded action available after the current item is due. Acknowledgment is an explicit operator action that closes the item. Repeating either action for the same already-recorded occurrence preserves its state.

Due lists all unacknowledged items whose due time has passed, including items recorded as displayed. Listing alone leaves the state untouched. No delivery transport or human-read receipt is inferred.

## CLI example

Requires Node 26.11.1, installed repository dependencies and jq. Run from the repository root. All input below is synthetic.

```sh
store=$(mktemp -d "$(pwd -P)/test-output/a15-example.XXXXXX")
reminder() { node src/research-cli.mjs reminder "$@" --store "$store"; }
added=$(reminder add --text 'Recheck the synthetic disclosure' --due 2000-11-25T09:00:00+08:00 --reference fixture:report-1)
id=$(printf '%s\n' "$added" | jq -r .id)
reminder due
reminder due
reminder mark-shown --id "$id" --occurrence 1
reminder defer --id "$id" --occurrence 1 --due 2099-11-26T09:00:00+08:00
reminder due
reminder acknowledge --id "$id" --occurrence 2
reminder list
```

Run `mkdir -p test-output` before the example if needed. Use `node src/research-cli.mjs --help` to see the available commands.
