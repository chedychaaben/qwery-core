# YouTube Data API v3 Extension

API-key driver that fetches public video metadata + basic statistics for a channel, stages them in DuckDB, and exposes them for ad-hoc SQL.

## Config
- `apiKey` (string, required) — YouTube Data API key.
- `channelId` (string, required) — Channel ID (e.g., `UC...`).
- `maxResults` (int, optional, default 25, max 50) — number of videos to pull.
- `publishedAfter` / `publishedBefore` (RFC3339, optional) — client-side filters on `publishedAt`.

## Notes
- API key only: YouTube Analytics endpoints require OAuth2 and are not included.
- Data is refreshed per config; `CREATE OR REPLACE TABLE videos` each load.

## Example query
```sql
SELECT
  videoId,
  title,
  viewCount,
  likeCount,
  durationSeconds
FROM videos
ORDER BY publishedAt DESC
LIMIT 10;
```

## Testing

**Note**: There's a known issue with Vitest v4 and workspace packages that export TypeScript source files. Tests may fail with "Unknown file extension .ts" errors.

Workaround: Build the extensions-sdk package first:
```bash
pnpm --filter @qwery/extensions-sdk build
```

Then run tests:
```bash
pnpm --filter @qwery/extension-youtube-data-api-v3 test
```

