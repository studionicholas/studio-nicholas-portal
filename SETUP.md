# Studio Nicholas Portal — Setup (click by click)

This turns the prototype into a real app with proper logins and data that syncs
across devices. You'll do the account setup (about 15 minutes); the code is done.

There are two halves:
- **Part A — Supabase** (your database + logins). Done in a web browser.
- **Part B — Run the app** (on your computer, then optionally put it online).

You do NOT need to write any code. Just follow the steps.

---

## Part A — Set up Supabase (the backend)

### 1. Create a free account
1. Go to **https://supabase.com** and click **Start your project**.
2. Sign in with Google or GitHub (or email).

### 2. Create a project
1. Click **New project**.
2. Name it `studio-nicholas`.
3. Set a **database password** and **save it somewhere** (you won't need it day to day, but keep it).
4. Pick the region closest to you (e.g. *Sydney*).
5. Click **Create new project** and wait ~2 minutes for it to finish setting up.

### 3. Create the database tables
1. In the left sidebar, click **SQL Editor**.
2. Click **New query**.
3. Open the file `supabase/schema.sql` (in this project folder), copy **all** of it,
   and paste it into the box.
4. Click **Run** (bottom right). You should see *Success*.

### 4. Make yourself an admin
1. Still in the SQL Editor, click **New query** again.
2. Paste this, replacing the email with **your** studio email:
   ```sql
   insert into public.admins (email) values ('studio@studionicholas.com.au');
   ```
3. Click **Run**.

### 5. Create the login accounts
1. In the left sidebar, click **Authentication** → **Users** → **Add user** → **Create new user**.
2. Add **yourself** first: enter your studio email (the same one from step 4) and a password.
   - Tick **Auto Confirm User** so it works immediately.
3. Click **Add user** again for **each client**: their email + a password you choose.
   - Tick **Auto Confirm User** each time.
   - These are the details you'll give each client to log in.

### 6. Get your two keys
1. In the left sidebar, click **Project Settings** (gear icon) → **API**.
2. Copy the **Project URL** (looks like `https://abcd1234.supabase.co`).
3. Copy the **anon public** key (a long string). *Both are safe to share — your data
   is protected by the access rules from step 3.*
4. Send these two values to your developer, **or** paste them into the app yourself in Part B.

---

## Part B — Run the app

### 1. Install Node.js (one time)
- Go to **https://nodejs.org** and install the **LTS** version. Click through the installer.

### 2. Add your keys
1. In this project folder, find the file **`.env.example`**.
2. Make a copy of it and rename the copy to **`.env`** (just `.env`, no `.example`).
3. Open `.env` in any text editor and paste in your two values from Part A step 6:
   ```
   VITE_SUPABASE_URL=https://abcd1234.supabase.co
   VITE_SUPABASE_ANON_KEY=the-long-anon-key
   ```
4. Save the file.

### 3. Start it
Open a terminal **in this folder** and run:
```
npm install
npm run dev
```
Then open the link it prints (usually **http://localhost:5173**).

- Sign in with your **studio admin** email → you'll see the admin panel and can create projects.
- When you create a project, set its **client login email** to match a user you made in Part A step 5.
- Sign out and sign in as a **client** to see their view.

### 4. (Optional) Put it online
So clients can reach it from anywhere:
1. Create a free account at **https://vercel.com** (or Netlify).
2. Connect this project folder (or its GitHub repo) and deploy.
3. In the host's **Environment Variables**, add the same two values (`VITE_SUPABASE_URL`
   and `VITE_SUPABASE_ANON_KEY`).

---

## How day-to-day use works
- **New client:** create their user in Supabase (Authentication → Add user), then create
  their project in the admin panel with the matching email.
- **Reset a password:** do it in Supabase → Authentication → Users.
- **Everything else** (updates, meetings, fee proposals, messages) is done right in the app,
  and clients see it instantly on their own devices.

Stuck on any step? Tell me which number and I'll walk you through it.
