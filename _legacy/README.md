# Legacy Node.js monorepo

The original **Next.js** operator console (`apps/web`), **Prisma** schema, and **Node edge gateway** (`apps/edge-gateway`) live here for reference while the canonical stack is **Python** (`src/maritime_fuel_tracker`).

To run the old stack:

```bash
cd _legacy/apps/web
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```
