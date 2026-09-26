import { describe, it, expect, vi, afterEach } from 'vitest';
import { planJourney } from '../digitransit';

function mockFetchOnce() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { planConnection: { edges: [] } } }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('planJourney', () => {
  it('sends the requested departure time to planConnection', async () => {
    const fetchMock = mockFetchOnce();
    const when = '2026-09-27T06:00:00.000Z';

    await planJourney({ lat: 58.38, lon: 26.72 }, { lat: 58.37, lon: 26.75 }, { dateTime: when });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.query).toMatch(/\$dateTime: PlanDateTimeInput/);
    expect(body.query).toMatch(/dateTime: \$dateTime/);
    expect(body.variables.dateTime).toEqual({ earliestDeparture: when });
  });

  it('defaults to the current time when no dateTime is given', async () => {
    const fetchMock = mockFetchOnce();
    const before = Date.now();

    await planJourney({ lat: 58.38, lon: 26.72 }, { lat: 58.37, lon: 26.75 });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const sent = Date.parse(body.variables.dateTime.earliestDeparture);
    expect(sent).toBeGreaterThanOrEqual(before - 1000);
    expect(sent).toBeLessThanOrEqual(Date.now() + 1000);
  });
});
