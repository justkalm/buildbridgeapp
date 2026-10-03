# BuildBridge

A marketplace connecting developers with licensed, verified contractors.

## What's actually built vs. what's next

This is the **first working slice**, not the full product from the original
brief. Built and wired to real data:

- Developer signup/login (real accounts, hashed passwords)
- Browse verified contractors (reads from a real database)
- Contractor profile pages with real project history
- Quote request form → writes to the database → **fires a real email**
- An admin page for you to add contractors by hand (no self-signup yet)

**Not built yet, deliberately:** supplier accounts, interior designer
matching, contractor self-signup, payments, SMS notifications, reviews
submitted by real users. These come after this slice is proven — see
"What's next" at the bottom.

## Important: this has never been run against a real database

Every file here compiles cleanly (`npx tsc --noEmit` and `npx eslint .` both
pass, and `npx next build` compiles successfully) — but the sandbox this was
built in cannot reach Neon's servers or Prisma's binary host, so **no code
here has ever executed against a live database, and no email has ever
actually been sent.** The steps below are your first real test. If something
in this list doesn't work exactly as described, that's useful — it's the
kind of thing that only surfaces on first real contact with a live database,
and worth telling me about so it gets fixed.

## Setup — do these in order

### 1. Install dependencies

```bash
npm install
```

### 2. Create a database (Neon)

- Go to [neon.tech](https://neon.tech), sign up free, create a project.
- Copy the connection string it gives you (starts with `postgresql://`).

### 3. Set up your environment file

```bash
cp .env.example .env
```

Open `.env` and fill in:
- `DATABASE_URL` — paste the Neon connection string from step 2
- `NEXTAUTH_SECRET` — generate one with `openssl rand -base64 32`
- `ADMIN_PASSWORD` — pick a password only you know (this gates the admin
  add-contractor page)

Leave `RESEND_API_KEY` for step 6 — signup/login/browse all work without it,
only the quote-request email needs it.

### 4. Generate the Prisma client and create your tables

```bash
npx prisma generate
npx prisma validate
```

Run `validate` here specifically — it's the one check that couldn't run
during development. If it reports a schema problem, stop and fix that before
continuing; everything downstream assumes this passes.

```bash
npx prisma migrate deploy
```

This applies every migration in `prisma/migrations`, in order, to your Neon
database: it creates the tables on a fresh database and brings an existing one
up to date. It never deletes data on its own. Do **not** use `prisma db push`
any more: it skips the migration history, so the database and the migration
files drift apart. When the schema changes, a new numbered folder is added
under `prisma/migrations` and you run the same `migrate deploy` command.

### 5. Add your first real contractor

Open `prisma/seed.ts`. Edit the `contractors` array:
- Replace the placeholder `phone: '+91XXXXXXXXXX'` with a real number
- Fill in real details for a contractor you actually know
- Leave `verificationStatus: 'PENDING'` unless you've actually checked their
  license number against the state registry — don't mark something Verified
  just to make the demo look better

Then run:

```bash
npx prisma db seed
```

You can re-run this script anytime — it updates existing contractors (matched
by license number) rather than duplicating them.

### 6. Set up email (Resend)

- Go to [resend.com](https://resend.com), sign up with
  **moiz.patrawala04@gmail.com** specifically — the code uses Resend's shared
  test domain, which only delivers to the email you signed up with.
- Copy your API key, paste it into `.env` as `RESEND_API_KEY`.

Once you want to notify a *different* contractor's real email address
(not yourself), you'll need to verify your own domain in Resend's dashboard
first, then update the `from:` address in `src/lib/email.ts` — there's a
comment marking exactly where.

### 7. Run it

```bash
npm run dev
```

Open `http://localhost:3000`.

### 8. The actual test

1. Sign up as a developer at `/signup`
2. Go to `/browse` — you should see the contractor you seeded
3. Click into their profile, fill out "Request a Quotation", submit
4. Check moiz.patrawala04@gmail.com — you should get an email within a few
   seconds

If step 4 doesn't arrive: check your terminal running `npm run dev` for a
logged error from `sendQuoteRequestEmail` — every failure path logs to the
console rather than failing silently.

### 9. Add more contractors going forward

Once you're past the first test, don't keep editing `seed.ts` — go to
`/admin`, log in with your `ADMIN_PASSWORD`, and use the form there. It's
faster and it's what the seed script's fields were designed to match.

## Deploying (once local testing works)

- Push this repo to GitHub
- Import it into [Vercel](https://vercel.com)
- Add all the same env vars from your `.env` into Vercel's project settings
- Vercel will run `npx prisma generate` automatically as part of its build —
  this is standard for Prisma + Vercel and needs no extra config on your part
- Update `NEXTAUTH_URL` to your real deployed URL once you have one

## What's next (in rough priority order)

1. Prove the vertical slice works end-to-end locally (this README)
2. Deploy it and get a few real contractors added via `/admin`
3. Contractor self-signup (currently admin-only)
4. Reviews tied to verified projects (currently `rating`/`reviewCount` are
   plain fields you set by hand — see the comment in `schema.prisma`)
5. Supplier side, interior designer matching
6. Payments (registration fee, brokerage)
7. SMS notifications alongside email
