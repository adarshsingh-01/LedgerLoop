# LedgerLoop

LedgerLoop is a payment-operations workspace for a small Indian online seller. It takes orders, gateway payments and bank-statement lines, explains which records belong together, and keeps a trail of every human decision.

The live demo is [https://ledgerloop-hsvs.onrender.com](https://ledgerloop-hsvs.onrender.com). The books on that site are a fictional studio, **Nila Studio** in Kolkata, reconciling Razorpay against HDFC Bank. They are sample data so the rules can be read against a concrete story. They are not results from a real seller.

## The job it does

A seller who checks out a few hundred orders a month usually exports three files and lines them up in a spreadsheet:

- the order list
- the payment-gateway report
- the bank statement

Some rows match on a reference number. Others do not. One customer pays two invoices with a single transfer. A settlement arrives short because the gateway took a fee. A refund is recorded and the bank debit never shows up. LedgerLoop is the screen for that work. It proposes a match only with the evidence attached, and it does not treat an approximate match as confirmed money movement.

## Screens

| Screen | What you do there |
| --- | --- |
| Overview | See confirmed matches, suggestions waiting for a person, the value still open, and the latest audit lines. |
| SmartMatch | Read why two or more records were paired, then confirm or reject the suggestion. |
| Inbox | Work the discrepancies that are still unexplained. Each item has a likely cause, a next check, an owner, a note and a follow-up draft. |
| Lineage | Pick one order and see the path from the invoice to the customer payment, the fee, the settlement and the bank. The note at the top says where that path breaks. |
| Leakage | See patterns across the books: fees above the 2% contract, orders left unpaid after a capture, delayed settlements, and duplicate statement lines. |
| Import | Add order, payment or bank CSVs. Duplicate ids are skipped. A bad row is reported and the rest of the file still loads. |

The sidebar **Reset sample books** action wipes the current database and loads Nila Studio again. Use it on a database you are willing to replace.

## Stories in the sample books

These are the rows worth opening first.

| Order | What is going on |
| --- | --- |
| 1042 Priya Shah, ₹2,499 | The bank narration says "P SHA", not the UPI reference. SmartMatch suggests it and waits. |
| 1045–1049, settlement SET-8821 | Five orders total ₹49,000. The recorded fee is ₹800, and the bank credit is ₹48,200. That match confirms itself. |
| 1050 and 1051 Rohan Mehta | One NEFT of ₹3,000 equals ₹1,200 plus ₹1,800. Both invoices stay a suggestion until you confirm them. |
| 1055 Ananya Bose, ₹4,999 | The reference matches the bank, so the money is verified, but the order is still marked unpaid. |
| 1056 Diya Menon | Same unpaid-after-capture pattern, also from Instagram, so Leakage can group the channel. |
| 1060 Farhan Qureshi, ₹899 | The original credit is on the statement. The refund has no matching debit. |
| 1062 Tara Sen, ₹2,499 | Two credits, ₹1,000 and ₹1,499, add up to the invoice. |
| 1070 Vikram Seth, ₹15,480 | Captured on 16 Oct 2026 and still missing from the bank. |
| SET-9102 and SET-9108 | The bank credit ties out, but the fee is above the 2% contract. |
| A ₹640 line with reference DUPUTR77 | The same bank line was imported twice, so it is flagged instead of matched. |
| A ₹750 credit with no order id | The payment reached the bank and no invoice was attached. |

`samples/orders.csv`, `samples/payments.csv` and `samples/bank.csv` add one more order, 2101 Neel Joshi, that matches on reference, plus one invalid order row so the import report has an error to show.

## Matching rules

Amounts are stored as integer paise. ₹2,499 is `249900`. Comparisons never use floating-point rupees.

The matcher in `server/src/match.js` is plain JavaScript. It does not import Mongoose, which is why `npm test` can run without a database. A rejected suggestion is remembered by fingerprint and is not offered again.

| Rule | Confirms itself? | When it fires |
| --- | --- | --- |
| `exact_reference` | Yes | A capture or refund reference of at least six characters appears on a bank line of the same amount and direction. |
| `settlement_net` | Yes | The bank credit equals the settlement reference, and that amount equals the gross of the batched orders minus the recorded fee. |
| `split_transfer` | No | One credit equals two open invoices for the same customer, and the narration contains that customer's name. |
| `customer_amount` | No | The amounts match and the narration contains the customer's name, but the payment reference is not on the statement. |
| `instalments` | No | Two or more captures for one order add up to the invoice. |

Anything that is not one of those confirmed cases becomes an inbox item:

- refund recorded, no bank debit
- payment with no invoice
- order still unpaid after a capture
- capture older than three days with no bank line and no settlement
- gateway fee above 2% of the gross, even when the net matches the bank
- two bank lines with the same reference, amount and direction

Inbox rank is amount multiplied by how old the record is. The follow-up text is a draft. Nothing is emailed.

Confirming, rejecting, updating an exception, marking an order paid, importing a file and each automatic confirmation writes an audit row with the actor. Automatic matches are attributed to LedgerLoop. Manual actions are attributed to Adarsh Singh, the operator on these sample books.

## Layout

```
client/                 React UI (Vite, Tailwind)
server/src/match.js     Matching and lineage rules
server/src/models.js    Mongoose models
server/src/routes.js    HTTP API
server/src/seed.js      Nila Studio sample books
server/src/csv.js       CSV import
server/test/            Matcher tests, no database required
samples/                Small CSVs for the import screen
render.yaml             Render web service
docker-compose.yml      Local MongoDB 7
```

The client talks to `/api`. In development, Vite on port 5173 proxies that path to the API on port 4000. In production, Express serves the built client and the API from one process.

## Collections

| Collection | Holds |
| --- | --- |
| `orders` | Invoice id, customer, amount, status, channel, product, date |
| `payments` | Captures, refunds and settlements. A settlement stores the net amount and the fee. |
| `banktxns` | Statement lines: credit or debit, narration, reference, amount, date |
| `matches` | A rule, a confidence, an explanation, the linked records, and `suggested`, `confirmed` or `rejected` |
| `exceptions` | Open discrepancies, with status, owner, note and priority |
| `audits` | Append-only record of decisions |

Order, payment and bank ids are unique. Importing the same id again skips that row.

## CSV columns

Amounts are rupees. Dates must parse as a JavaScript date, for example `2026-10-22`.

Orders: `order_id, customer, amount, status, channel, placed_at, product`

Payments: `payment_id, type, provider, reference, amount, fee, order_id, customer, paid_at, settlement_id`

`type` is `capture`, `refund` or `settlement`.

Bank: `bank_id, posted_at, direction, amount, narration, reference`

`direction` is `credit` or `debit`.

The same files can be downloaded from the Import screen at `/api/samples/orders`, `/api/samples/payments` and `/api/samples/bank`. Files are limited to 2 MB.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness check |
| GET | `/api/overview` | Counts, suggestions, top exceptions, recent audit |
| GET | `/api/matches?status=suggested` | `suggested`, `confirmed` or `rejected` |
| POST | `/api/matches/:id/confirm` | Accept a suggestion |
| POST | `/api/matches/:id/reject` | Reject it so it is not suggested again |
| GET | `/api/exceptions` | Inbox, including a follow-up draft |
| POST | `/api/exceptions/:id` | Set `status`, `owner` or `note` |
| POST | `/api/orders/:orderId/mark-paid` | Mark an order paid and resolve that exception |
| GET | `/api/orders` | Order list for the lineage picker |
| GET | `/api/lineage/:orderId` | Stages and the break note |
| GET | `/api/leakage` | Fee, channel, delay and duplicate counts |
| GET | `/api/audit` | Latest 40 audit events |
| POST | `/api/imports/:source` | Multipart field `file`. `source` is `orders`, `payments` or `bank` |
| POST | `/api/reset` | Delete the books and load the sample again |

Exception statuses are `open`, `investigating`, `waiting` and `resolved`.

## Run it locally

Node.js 22 or newer.

```bash
npm install
npm test
npm run dev
```

Open http://localhost:5173.

`npm test` runs `server/test/match.test.js` with Node's built-in test runner. The tests cover an exact reference, a nickname that must stay a suggestion, a split transfer, a settlement that explains its fee, a fee above the 2% contract, a refund with no debit, a rejected fingerprint, and a lineage break.

If `MONGODB_URI` is unset, the server starts an in-memory MongoDB 7, creates the database `ledgerloop`, and loads the sample books when the order collection is empty. That data disappears when the process stops.

For a database that survives restarts, start MongoDB 7 and point the app at it:

```bash
docker compose up -d
copy .env.example .env
npm run dev
```

`.env.example` contains:

```
MONGODB_URI=mongodb://127.0.0.1:27017/ledgerloop
PORT=4000
```

An Atlas connection string works in the same variable. Put the database name in the path, for example `...mongodb.net/ledgerloop?retryWrites=true&w=majority`. Do not commit `.env`.

One process, serving the built UI and the API on port 4000:

```bash
npm run build
npm start
```

## Hosted demo

`render.yaml` is a free Render web service. The public site is [https://ledgerloop-hsvs.onrender.com](https://ledgerloop-hsvs.onrender.com).

The service reads `MONGODB_URI` from the Render environment. The current deployment uses an Atlas cluster and the database `ledgerloop`. The connection string is an environment variable, not a file in this repository. If the variable is removed, the service falls back to the in-memory database and loads the sample books on boot.

A free Render instance sleeps after a few minutes without traffic and takes about a minute to wake. CSV rows imported on the hosted site stay in Atlas across those restarts. **Reset sample books** replaces whatever is in the connected database with the Nila Studio seed.

If Atlas refuses the connection, allow `0.0.0.0/0` in the cluster network access list. Render's free instances do not keep one outbound IP.

## Accounts and stores

The app opens on a sign-in screen. Create an account with your name, email, a password of at least 8 characters, and a store name. You can tick **Load the Nila Studio sample books** so the new store is not empty.

After you are in, the store menu in the sidebar switches books. **Add a store** creates another one for the same login. Orders, payments, matches, exceptions and audit rows belong to that store. Reloading the sample books replaces only the store you have open.

The first account created on a database that already holds the old single set of books is given that **Nila Studio** store as well.

The session is an httpOnly cookie named `ll_token`, signed with `JWT_SECRET`. Set that variable in `.env` locally and in the host's environment. It is not stored in git.

## What this version deliberately leaves out

A login can own several stores. It cannot invite a second person into the same store. The fee contract on a new store is 2%. The matcher handles pairs of invoices, not every possible subset of a large unpaid list. Those are the boundaries of this project, not claims about a production reconciliation system.
