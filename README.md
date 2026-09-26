# QR Attendance

A QR-based student attendance system, built as a **starting point** for a college
project. Students get a QR code, a teacher scans it, and an attendance record is
saved.

This repo is a **working starting point**, not a finished product. The create →
scan → mark present/absent/late → save to the database path works, but it has no
login, no reports and no admin tooling. See
[Left for you to implement](#left-for-you-to-implement) for the rest.

## Tech stack

| Tool | What it is used for |
| --- | --- |
| [Next.js](https://nextjs.org) 16 (App Router) | The website and the pages/routes |
| TypeScript | Types, so mistakes get caught while you code |
| [Tailwind CSS](https://tailwindcss.com) v4 | All the styling |
| [Supabase](https://supabase.com) | The database (PostgreSQL) |
| [react-qr-code](https://github.com/yqchildey/react-qr-code) | Drawing the QR code a student shows |
| [html5-qrcode](https://github.com/miichaelsaldivar/html5-qrcode) | Reading a QR code with the phone camera |

## How the flow works

1. A student opens **/create-qr**, types their name and student ID, and presses
   **Generate QR**. That saves a row to `students` and shows a QR code.
2. A teacher opens **/scanner** on their phone and presses **Scan**.
3. The camera reads the QR code, the app looks up the matching row in
   `students`, and the student's details appear.
4. The teacher picks **Present**, **Absent** or **Late** and presses **Update
   attendance**. That writes a row to `attendance`.

The QR code contains a small JSON string, which `lib/qr-payload.ts` builds and
reads:

```json
{ "student_id": "CSE2023001" }
```

## Folder structure

```
.
├── app/
│   ├── layout.tsx          # Shared shell: fonts, navbar, footer
│   ├── page.tsx            # Homepage with "Create My QR" and "Scan QR"
│   ├── globals.css         # Tailwind import + a couple of colour variables
│   ├── create-qr/
│   │   └── page.tsx        # /create-qr - name, ID, save student, show QR
│   └── scanner/
│       └── page.tsx        # /scanner - camera, lookup, status, save
├── components/
│   └── Navbar.tsx          # Top navigation bar
├── lib/
│   ├── supabase.ts         # The Supabase client you use everywhere
│   └── qr-payload.ts       # Builds and reads the string inside the QR code
├── supabase/
│   └── schema.sql          # students + attendance tables
├── .env.example            # Copy to .env.local and fill in
└── README.md
```

`app/` is the only special folder in Next.js — every folder inside it becomes a
URL. `app/create-qr/page.tsx` is served at `/create-qr`. Everything else is
ordinary React.

### Where to start reading the code

Suggested order, roughly easiest to hardest:

1. `app/page.tsx` — the homepage. Just two links.
2. `components/Navbar.tsx` — the bar at the top.
3. `app/create-qr/page.tsx` — a form, one database call, one QR code. Its top
   comment explains what pressing the button does.
4. `app/scanner/page.tsx` — the hardest file, because it drives a third-party
   camera library. **Start with the "READ THIS FIRST" block at the top**, which
   walks through the four functions in the order they run, then read
   `findStudent()` and `handleUpdate()`. The `html5-qrcode` plumbing in
   `startScanner()` is commented too, but you can safely skip it on a first pass.
5. `lib/qr-payload.ts` — the string format both pages share.
6. `supabase/schema.sql` — the two tables.

## Setting up Supabase

You need a free Supabase account. It takes a few minutes.

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Once it finishes setting up, open **SQL Editor** in the sidebar, click
   **New query**, paste the whole contents of [`supabase/schema.sql`](supabase/schema.sql)
   and click **Run**. This creates your two tables.
3. Go to **Project Settings → API Keys** and copy two values:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **Publishable key** (starts with `sb_publishable_`)

   Older projects call that second one the **anon** key and it starts with
   `eyJ...` instead. It is the same low-privilege key under an older name —
   Supabase renamed it, and any project created after November 2025 only has the
   new-style one. Either value works in `.env.local`.

4. In this project, copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local    # macOS / Linux
   copy .env.example .env.local   # Windows
   ```

5. Open `.env.local` and paste your two values in:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
   ```

6. Restart `npm run dev` so the new file is picked up.

The publishable key is designed to be used in the browser — it only grants what
your Row Level Security policies allow, which is why `schema.sql` sets up simple
`using (true)` policies.

Being safe to publish does **not** mean the project is safe. Right now those
policies allow anyone to read every student and insert any attendance row, so
anyone who opens the site can read your data and mark attendance. That is
deliberate, to keep the demo simple, but treat this key as public until you
add [login and roles](#left-for-you-to-implement).

The **secret** key (previously `service_role`) is **not** for you: it bypasses
all security rules. Never put it in this project and never commit it.

You can sanity-check the connection from the browser console once the app is
running:

```js
const { data, error } = await supabase.from("students").select("*");
```

`lib/supabase.ts` logs a warning but does not crash if `.env.local` is missing,
so the pages still render before you set up Supabase.

## Running it locally

You need [Node.js](https://nodejs.org) 20.9 or newer.

```bash
npm install     # install packages
npm run dev     # start the dev server
```

Open [http://localhost:3000](http://localhost:3000). Edit any file and the page
updates as you save.

**Camera access only works on `localhost` or over HTTPS.** To try the scanner on
your phone you need HTTPS, so use a tunnel such as
[`ngrok`](https://ngrok.com) or deploy to Vercel. A plain `http://192.168.x.x`
address from your laptop will fail with a camera permission error.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Make a production build |
| `npm start` | Run the production build |
| `npm run lint` | Check for code style problems |
| `npm run typecheck` | Check that TypeScript types line up |

## Testing the flow

1. Fill in `/create-qr` with a name and ID and press **Generate QR**. Copy the
   encoded value shown under the QR if you want to check it.
2. Open `/scanner` in another browser tab and press **Scan**. Grant camera
   permission.
3. Point the camera at the QR. If you are on a laptop, a second device showing
   the QR works too.
4. Pick a status and press **Update attendance**.
5. Check the row landed:
   ```sql
   select * from public.attendance order by scanned_at desc;
   ```

## Left for you to implement

The two screens work end to end, but this is still a demo. Things worth
building next, roughly in order of difficulty:

1. **Login and roles** — nothing here is authenticated, and any device can mark
   attendance. Add [Supabase Auth](https://supabase.com/docs/guides/auth) and
   make only teachers reach `/scanner`. Then tighten the RLS policies in
   `supabase/schema.sql`, which are currently wide open.
2. **Attendance reports** — a page to view a student's history, a class list,
   or a percentage. Nothing reads the `attendance` table yet.
3. **Departments and subjects** — `students.department` exists but has no input.
   There is no `subjects` or `classes` table, so "which class is this attendance
   for?" has no answer yet.
4. **Duplicate scans** — `attendance` has one row per student per day, so a
   second scan silently overwrites the first. Decide whether that should warn
   the teacher.
5. **Admin panel** — adding/removing students, fixing roll numbers, viewing a
   live class.
6. **QR payload security** — the payload is just a roll number in plain text, so
   anyone can craft a QR for someone else. Look into signing the payload.

Keep it simple while you build. Get one student marked present, then expand.
