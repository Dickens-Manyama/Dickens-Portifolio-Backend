# Portfolio Backend API (Express + Prisma + PostgreSQL)

Production-ready backend for the portfolio frontend.

## Endpoints

- `GET /health`
- `GET /api/profile`
- `GET /api/skills` (grouped)
- `GET /api/projects`
- `POST /api/contact`

## Setup (local)

1) Copy env file:

```bash
cp .env.example .env
```

2) Set `DATABASE_URL` to your PostgreSQL connection string.

3) Install and generate Prisma client:

```bash
npm install
npm run prisma:generate
```

4) Create tables (choose one):

- **Recommended (migrations)**:

```bash
npm run prisma:migrate:dev
```

- **Quick (no migrations)**:

```bash
npx prisma db push
```

5) Seed sample data:

```bash
npm run seed
```

6) Run server:

```bash
npm start
```

Server listens on `PORT` (default `5000`).

## Render deployment

1) Create a new Web Service on Render pointing at this `Backend/` folder.
2) Add environment variables:
   - `DATABASE_URL` = your Render Postgres connection string
   - `PORT` = `5000`
   - `CLIENT_URL` = `https://dickens-portifolio.vercel.app`
    - `ADMIN_INACTIVITY_TIMEOUT_MS` = optional inactivity timeout in milliseconds for admin sessions (default `300000` = 5 minutes). When set, the server tracks `last_activity` for admin accounts and will return `401` for requests after the timeout.
3) Build command:

```bash
npm install
```

4) Start command:

```bash
node index.js
```

5) After first deploy, run migrations + seed (Render Shell):

```bash
npx prisma migrate deploy
node prisma/seed.js
```

## Example responses

### `GET /api/profile`

```json
{
  "ok": true,
  "data": {
    "id": 1,
    "name": "Dickens Deus Manyama",
    "title": "Software Developer | Data Scientist | IT Systems & Networking",
    "summary": "Cloud and software developer with experience in Laravel, React, APIs, and data science.",
    "email": "dickensmanyama8@gmail.com",
    "phone": "0679 165 468 / 0692 501 112",
    "github": "https://github.com/Dickens-Manyama",
    "linkedin": "https://www.linkedin.com/in/dickens-manyama-560450327"
  }
}
```

### `GET /api/skills`

```json
{
  "ok": true,
  "data": [
    { "category": "Programming", "skills": [{ "id": 1, "name": "PHP" }] }
  ]
}
```

### `POST /api/contact`

Request:

```json
{ "name": "Jane", "email": "jane@example.com", "message": "Hello!" }
```

Response:

```json
{
  "ok": true,
  "data": {
    "id": 1,
    "createdAt": "2026-05-13T00:00:00.000Z",
    "message": "Thanks! Your message was received."
  }
}
```

