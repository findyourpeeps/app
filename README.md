# Find Your Peeps (`findyourpeeps`)

Next.js App Router application for curated pickleball nights (ages 25–45, email only, invitation-only). Member routes and `/ops` staff routes. **Local development uses an in-memory product stub**—no live Supabase or Resend.

## Commands

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

Health check: `GET /api/health`

## Slices in this tree

- **S0–S6:** identity, profile, availability, venues/events, curation, invitations (see `src/lib/product/slices-s2-s6.test.ts`).
- **S7–S12:** reconfirmation, go/no-go, material reschedule, online check-in, follow-up, connections (verified email, 72h authorization), safety reports/blocks, deletion request/cancel and purge helper (see `src/lib/product/slices-s7-s12.test.ts`).

Outbox rows remain **held** (no external email).

## Auth stub

`src/lib/auth/local-auth-store.ts` implements magic links, signup, and role grants for local dev.

SQL migrations under `supabase/migrations/` mirror the spec schema incrementally; production integration waits on launch blockers.
