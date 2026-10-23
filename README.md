# LedgerLoop

Explainable payment reconciliation for a small Indian D2C seller. LedgerLoop matches orders, gateway payments and bank lines, explains every suggestion, and keeps a record of who confirmed it.

The books you see on first launch are a fictional studio, **Nila Studio** in Kolkata. They are there so the matching rules can be read against a concrete story. They are not pilot results.

## What it shows

- **SmartMatch** confirms an exact reference, or a settlement that equals gross minus the recorded fee. Nickname matches, split transfers and instalments stay suggestions.
- **Inbox** ranks open discrepancies and drafts a follow-up. A person assigns an owner, writes a note and marks the outcome.
- **Lineage** walks one order from the invoice to the bank and says where the trail breaks.
- **Leakage** counts repeated fee gaps, unpaid-but-captured orders, delayed settlements and duplicate statement lines.
- **Import** loads order, payment and bank CSVs, skips duplicate ids, and reports bad rows without dropping the rest of the file.

## Stack

MongoDB, Express, React and Node.js. The matcher is plain JavaScript with no database, so the rules can be tested on their own.

If `MONGODB_URI` is unset, the server starts an ephemeral MongoDB and loads the sample books. Set the variable to use Docker or Atlas instead. The Mongoose models stay the same.

## Run

```bash
npm install
npm test
npm run dev
```

Open http://localhost:5173.

For a persistent database:

```bash
docker compose up -d
copy .env.example .env
npm run dev
```

Production, one process:

```bash
npm run build
npm start
```

The API and the built UI then share port 4000.

## Deploy

`render.yaml` describes a free [Render](https://render.com) web service. Leave `MONGODB_URI` unset and the service boots an ephemeral MongoDB with the sample books. Set `MONGODB_URI` when you want the same models to use Atlas or the Docker database instead. A free Render service sleeps after a few minutes of quiet and wakes on the next visit.

## Sample files

`samples/orders.csv`, `samples/payments.csv` and `samples/bank.csv` add one new order that matches on reference, plus one invalid order row so the import report has something to show.
