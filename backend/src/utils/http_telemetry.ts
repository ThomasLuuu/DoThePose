const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Collapse UUIDs so route keys aggregate for p50/p95. */
export function normalizeHttpRouteKey(method: string, urlPath: string): string {
  const pathOnly = urlPath.split('?')[0] || urlPath;
  const normalized = pathOnly.replace(UUID_RE, ':id');
  return `${method} ${normalized}`;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx] ?? 0;
}

export interface LatencyBucket {
  count: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
}

export interface DurationSample {
  key: string;
  durationMs: number;
  ts: number;
}

export function aggregateDurationsMs(
  samples: DurationSample[],
  sinceMs?: number
): Record<string, LatencyBucket> {
  const cutoff = sinceMs ? Date.now() - sinceMs : 0;
  const byKey = new Map<string, number[]>();
  for (const s of samples) {
    if (s.ts < cutoff) {
      continue;
    }
    const key = s.key;
    if (!key) {
      continue;
    }
    let arr = byKey.get(key);
    if (!arr) {
      arr = [];
      byKey.set(key, arr);
    }
    arr.push(s.durationMs);
  }
  const out: Record<string, LatencyBucket> = {};
  for (const [key, times] of byKey) {
    const sorted = [...times].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    out[key] = {
      count: sorted.length,
      avgMs: sum / sorted.length,
      p50Ms: percentile(sorted, 0.5),
      p95Ms: percentile(sorted, 0.95),
    };
  }
  return out;
}
