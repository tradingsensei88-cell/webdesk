# 🚀 How to Run — Antigravity SAP Project

A complete step-by-step guide to get this project running on any machine from scratch.

---

## 📋 Prerequisites

Before you begin, make sure the following are installed on the target machine:

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | v18.x or v20.x (LTS) | [nodejs.org](https://nodejs.org) |
| **npm** | v9+ (comes with Node.js) | Bundled with Node.js |
| **Git** | Any recent version | [git-scm.com](https://git-scm.com) |

> [!IMPORTANT]
> **Node.js v18 or v20 is required.** The project uses Next.js 15 and React 19 which require a modern Node.js version. Do NOT use Node.js v16 or below.

To verify your versions, run:
```bash
node -v
npm -v
git --version
```

---

## 📁 Step 1 — Clone the Repository from GitHub

```bash
git clone https://github.com/tradingsensei88-cell/SAP-project.git
cd SAP-project
```

> [!NOTE]
> If the repository is private, you will need to be added as a collaborator or use a personal access token (PAT) for authentication.

The cloned repo will include:
```
SAP-project/
├── src/
├── prisma/
├── public/
├── dev.db              ← SQLite database (included in repo)
├── package.json
├── package-lock.json
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
└── How-to-run.md
```

> [!CAUTION]
> The `.env` file is **NOT included** in the repository (it is gitignored for security). You must create it manually — see **Step 3**.
> `node_modules/` and `.next/` are also excluded and will be regenerated.

---

## 📦 Step 2 — Install Dependencies

Open a terminal in the project root folder and run:

```bash
npm install
```

This will install all packages listed in `package.json`, including:

| Package | Purpose |
|---------|---------|
| `next` | Next.js framework |
| `react`, `react-dom` | React 19 |
| `@prisma/client` | Database ORM client |
| `@prisma/adapter-better-sqlite3` | SQLite adapter for Prisma |
| `better-sqlite3` | SQLite database driver |
| `next-auth` | Authentication (credentials + Google OAuth) |
| `bcryptjs` | Password hashing |
| `cloudinary`, `next-cloudinary` | Video/image uploads |
| `framer-motion` | Animations |
| `lucide-react` | Icons |
| `recharts` | Analytics charts |
| `tailwindcss` | CSS framework |

> [!NOTE]
> `better-sqlite3` is a native Node.js module. On some machines it may need to be compiled. If `npm install` fails with a build error, install the Windows Build Tools first:
> ```bash
> npm install --global windows-build-tools
> ```
> Or on Linux/macOS, make sure `python3` and `build-essential` / `Xcode CLI tools` are installed.

---

## ⚙️ Step 3 — Set Up Environment Variables

> [!CAUTION]
> The `.env` file is **gitignored** and will never be committed to GitHub. You must create it manually on every machine you run this project on.

Create a file named **`.env`** in the project root and fill in the following:

```env
# Database — SQLite file path (do not change this)
DATABASE_URL="file:./dev.db"

# Auth Secret — generate a random string (MUST be changed in production)
AUTH_SECRET="your-random-secret-key-at-least-32-chars"

# Google OAuth — optional, only needed if using Google login
# Get these from: https://console.cloud.google.com/
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"

# Cloudinary — required for video/image uploads
# Get these from: https://cloudinary.com/console
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="your-cloud-name"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

> [!IMPORTANT]
> **`AUTH_SECRET`** must be set to a strong random string. You can generate one with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

> [!NOTE]
> **Google OAuth** is optional for local development. If you skip it, only email/password login will work. To enable Google login, create OAuth credentials at [console.cloud.google.com](https://console.cloud.google.com) and add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.

> [!NOTE]
> **Cloudinary** is required for instructor video uploads. Create a free account at [cloudinary.com](https://cloudinary.com) and copy your Cloud Name, API Key, and API Secret from the dashboard.

---

## 🗄️ Step 4 — Set Up the Database

The project uses **SQLite** via Prisma. The database file `dev.db` is included in the repository.

### Option A — `dev.db` is present (default after cloning)
Just generate the Prisma client:

```bash
npx prisma generate
```

### Option B — Starting fresh (no `dev.db`)
Run migrations to create the database schema, then generate the client:

```bash
npx prisma migrate deploy
npx prisma generate
```

> [!NOTE]
> If `migrate deploy` fails, try:
> ```bash
> npx prisma db push
> npx prisma generate
> ```

### Verify the database is working
```bash
node -e "const db = require('better-sqlite3')('./dev.db'); console.log('Tables:', db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all().map(t=>t.name).join(', ')); db.close();"
```

You should see a list of tables like: `User, Account, Session, Course, Module, Video, Enrollment, ...`

---

## ▶️ Step 5 — Start the Development Server

```bash
npm run dev
```

The app will start at **[http://localhost:3000](http://localhost:3000)**

> [!TIP]
> If port 3000 is already in use, Next.js will automatically try port 3001, 3002, etc. Check the terminal output for the actual URL.

---

## 👤 Step 6 — Create Your First Account

1. Open [http://localhost:3000/register](http://localhost:3000/register)
2. Register with an email and password
3. By default, new accounts are created as **students**

### To create an Instructor account
After registering, update the role directly in the database:

```bash
node -e "const db = require('better-sqlite3')('./dev.db'); db.prepare(\"UPDATE User SET role='instructor' WHERE email=?\").run('your-email@example.com'); console.log('Done'); db.close();"
```

Replace `your-email@example.com` with the email you registered with.

---

## � Committing & Pushing Changes to GitHub

### First-time setup (if not already done)
```bash
git init
git remote add origin https://github.com/tradingsensei88-cell/SAP-project.git
```

### Standard workflow for committing changes

```bash
# 1. Check what files have changed
git status

# 2. Stage your changes
git add .

# 3. Commit with a descriptive message
git commit -m "your commit message here"

# 4. Push to GitHub
git push origin main
```

> [!IMPORTANT]
> The `.env` file is gitignored and will **never** be pushed to GitHub — this is intentional to keep your secrets safe.

> [!NOTE]
> If `dev.db` has changed (e.g. new schema migrations), it **will** be committed since it is tracked by Git. This is fine for development — just make sure not to commit sensitive user data in production.

### Useful Git commands

```bash
# See commit history
git log --oneline

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Pull latest changes from GitHub
git pull origin main

# Create and switch to a new branch
git checkout -b feature/your-feature-name
```

---

## �🔧 Common Issues & Fixes

### ❌ `better-sqlite3` build error on Windows
```bash
npm install --global node-gyp
npm install --global windows-build-tools
npm install
```

### ❌ `PrismaClientConstructorValidationError`
The Prisma client needs to be regenerated:
```bash
npx prisma generate
```

### ❌ Port 3000 already in use
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :3000
kill -9 <PID>
```

### ❌ `AUTH_SECRET` error on startup
Make sure `.env` exists and `AUTH_SECRET` is set to a non-empty string.

### ❌ Google login not working
Either set up Google OAuth credentials (see Step 3) or just use email/password login — Google login is optional.

### ❌ Video uploads not working
Make sure all 4 Cloudinary variables are correctly set in `.env`.

### ❌ `git push` rejected (not up to date)
```bash
git pull origin main --rebase
git push origin main
```

---

## 🏗️ Building for Production (Optional)

If you want to run the production build instead of dev mode:

```bash
npm run build
npm run start
```

> [!WARNING]
> The production build requires all environment variables to be correctly set, including Cloudinary. Make sure `.env` is complete before building.

---

## 📂 Project Structure (Quick Reference)

```
src/
├── app/                  # Next.js App Router pages
│   ├── page.tsx          # Home page
│   ├── login/            # Login page
│   ├── register/         # Registration page
│   ├── dashboard/        # Student dashboard
│   ├── instructor/       # Instructor studio
│   ├── courses/          # Course browsing & learning
│   └── api/              # API routes
├── components/           # Reusable React components
│   ├── landing/          # Home page sections
│   └── ...
├── lib/
│   └── prisma.ts         # Prisma client singleton
├── auth.ts               # NextAuth configuration
├── auth.config.ts        # Auth middleware config
└── middleware.ts          # Route protection
prisma/
└── schema.prisma         # Database schema
dev.db                    # SQLite database file (tracked in Git)
```

---

## ✅ Quick Checklist

- [ ] Node.js v18+ installed
- [ ] Repository cloned from GitHub
- [ ] `npm install` completed successfully
- [ ] `.env` file created manually with all required variables
- [ ] `dev.db` file present in project root
- [ ] `npx prisma generate` run successfully
- [ ] `npm run dev` started without errors
- [ ] App accessible at `http://localhost:3000`
