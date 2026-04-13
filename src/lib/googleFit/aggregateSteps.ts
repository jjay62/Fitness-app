/**
 * Google Fitness API: aggregate step_count.delta for a time range (ms since epoch).
 * https://developers.google.com/fit/rest/v1/reference/users/dataset/aggregate
 */

const AGGREGATE_URL = 'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate';

interface FitValue {
  intVal?: number;
  fpVal?: number;
}

interface FitPoint {
  value?: FitValue[];
}

interface FitDataset {
  point?: FitPoint[];
}

interface FitBucket {
  dataset?: FitDataset[];
}

interface AggregateResponse {
  bucket?: FitBucket[];
}

function sumPointValues(point: FitPoint): number {
  if (!point.value?.length) return 0;
  let n = 0;
  for (const v of point.value) {
    if (typeof v.intVal === 'number') n += v.intVal;
    else if (typeof v.fpVal === 'number') n += Math.round(v.fpVal);
  }
  return n;
}

export async function fetchAggregatedStepsForRange(
  accessToken: string,
  startTimeMillis: number,
  endTimeMillis: number
): Promise<number> {
  const body = {
    aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }],
    bucketByTime: { durationMillis: endTimeMillis - startTimeMillis },
    startTimeMillis,
    endTimeMillis,
  };

  const res = await fetch(AGGREGATE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fitness API ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as AggregateResponse;
  let total = 0;
  for (const bucket of json.bucket || []) {
    for (const ds of bucket.dataset || []) {
      for (const pt of ds.point || []) {
        total += sumPointValues(pt);
      }
    }
  }
  return Math.round(total);
}
