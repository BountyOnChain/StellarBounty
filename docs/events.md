# StellarBounty Event Schema

All state-changing functions in the EscrowContract emit Soroban events so off-chain
indexers and frontends can track bounty lifecycle transitions without scraping every
transaction.

## Topic Shape

Every event uses the same topic structure:

```
(symbol_short!("event_name"), actor_address)
```

- `event_name` — a short Soroban symbol identifying the event type (max 9 chars)
- `actor_address` — the `Address` that triggered the state change (caller)

## Event Table

| Event Name   | Emitted By     | Status Transition        | Data Fields                                          |
|-------------|----------------|--------------------------|------------------------------------------------------|
| `init`       | `initialize()`  | → `Created`              | `(amount: i128, token: Address, arbitrator: Address)` |
| `fund`       | `fund()`        | `Created` → `Funded`     | `(amount: i128)`                                      |
| `startwork`  | `start_work()`  | `Funded` → `InProgress`  | *(none)*                                              |
| `submit`      | `submit()`      | `InProgress` → `UnderReview` | *(none)*                                          |
| `approve`    | `approve()`     | `UnderReview` → `Completed` | `(amount: i128, contributor: Address)`              |
| `cancel`     | `cancel()`      | `Created`/`Funded` → `Cancelled` | `(refund: Option<i128>)` — `Some(amount)` if was funded, `None` if was only created |
| `dispute`    | `dispute()`     | `UnderReview` → `Disputed` | *(none)*                                              |
| `resolve`    | `resolve()`     | `Disputed` → `Completed`  | *(none)*                                              |

## Ordering

Events are emitted **before** the final storage write in each function, ensuring the
event data and the on-chain state change are committed in the same host-function
invocation. Events appear in transaction logs in the same order as the state
transitions.

## JavaScript Subscription Example (Soroban RPC)

```javascript
import { Server } from 'stellar-sdk/rpc';

const server = new Server('https://soroban-testnet.stellar.org');

async function watchBountyEvents(contractId) {
  const response = await server.getEvents({
    startLedger: await server.getLatestLedger().then(l => l.sequence),
    filters: [
      {
        type: 'contract',
        contractIds: [contractId],
        topics: [
          // Match any event from this contract
          [wildcard()],
        ],
      },
    ],
  });

  for (const event of response.events) {
    const eventName = event.topic[0].sym().toString();
    const actor = event.topic[1].address().toString();
    const data = event.value;

    console.log(`[${eventName}] actor=${actor}`, data);
  }
}
```

## Notes

- `dispute` and `resolve` events pre-date this schema and use a simpler data payload.
  A follow-up PR can unify their data format with the table above.
- All events use `symbol_short!` topics, which are limited to 9 characters of
  alphanumeric + underscore. The event names above all fit within this limit.
