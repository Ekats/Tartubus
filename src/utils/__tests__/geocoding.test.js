import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { forwardGeocode } from '../geocoding';

// One In-ADS row, as the gazetteer returns it (only the fields we read)
const inAdsRow = (overrides) => ({
  aadresstekst: 'Võru tn 30',
  asum: 'Kesklinna linnaosa, Riiamäe asum',
  omavalitsus: 'Tartu linn',
  liikVal: 'EHITISHOONE',
  viitepunkt_b: '58.372170',
  viitepunkt_l: '26.722618',
  ...overrides,
});

// One Nominatim search hit, as the API returns it
const nominatimHit = (overrides) => ({
  lat: '58.3722',
  lon: '26.7226',
  display_name: '30, Võru, Riiamäe, Kesklinn, Tartu linn, Tartu maakond, 51010, Eesti',
  ...overrides,
});

let inAds;
let nominatim;

// Answer each service separately, so a test can see which one was asked
function mockFetch({ inAdsAddresses = [], inAdsError = null, nominatimResults = [] } = {}) {
  globalThis.fetch = vi.fn(async (url) => {
    if (String(url).includes('inaadress.maaamet.ee')) {
      inAds.push(String(url));
      if (inAdsError) throw inAdsError;
      return { ok: true, json: async () => ({ addresses: inAdsAddresses }) };
    }
    nominatim.push(String(url));
    return { ok: true, json: async () => nominatimResults };
  });
}

beforeEach(() => {
  inAds = [];
  nominatim = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.fetch;
});

describe('forwardGeocode via In-ADS', () => {
  it('parses a row into a result labelled with its neighbourhood and municipality', async () => {
    mockFetch({ inAdsAddresses: [inAdsRow()] });

    const results = await forwardGeocode('Võru tn 30');
    expect(results).toEqual([{
      lat: 58.37217,
      lon: 26.722618,
      name: 'Võru tn 30, Riiamäe, Tartu linn',
      display_name: 'Võru tn 30, Riiamäe, Tartu linn',
    }]);
    // The query goes out with the Tartu county and feature filters
    expect(inAds[0]).toContain('address=V%C3%B5ru+tn+30');
    expect(inAds[0]).toContain('ehak=0079');
    expect(inAds[0]).toContain('features=EHITISHOONE%2CTANAV');
  });

  it('leaves out the neighbourhood when the row has no asum', async () => {
    mockFetch({ inAdsAddresses: [inAdsRow({ asum: '', omavalitsus: 'Kambja vald', aadresstekst: 'Võru mnt 30' })] });

    const [result] = await forwardGeocode('Võru 30');
    expect(result.display_name).toBe('Võru mnt 30, Kambja vald');
  });

  it('keeps the first of the rows the same address repeats as', async () => {
    mockFetch({ inAdsAddresses: [inAdsRow(), inAdsRow(), inAdsRow({ aadresstekst: 'Võru tn 30a' })] });

    const results = await forwardGeocode('Võru tn 30');
    expect(results.map(r => r.name)).toEqual(['Võru tn 30, Riiamäe, Tartu linn', 'Võru tn 30a, Riiamäe, Tartu linn']);
  });

  it('drops rows outside Tartu and rows with no address or coordinates', async () => {
    mockFetch({ inAdsAddresses: [
      inAdsRow({ aadresstekst: 'Tartu mnt 5', omavalitsus: 'Elva vald', viitepunkt_b: '58.2225', viitepunkt_l: '26.4214' }),
      inAdsRow({ aadresstekst: '', liikVal: 'EHAK' }),
      inAdsRow({ aadresstekst: 'Riia tn 2', viitepunkt_b: '', viitepunkt_l: '' }),
      inAdsRow(),
    ] });

    const results = await forwardGeocode('Võru tn 30');
    expect(results.map(r => r.name)).toEqual(['Võru tn 30, Riiamäe, Tartu linn']);
  });

  it('leads with the place name when In-ADS matched a place, not an address', async () => {
    mockFetch({ inAdsAddresses: [inAdsRow({
      aadresstekst: 'Lääneringtee 39',
      asum: 'Ränilinna linnaosa, Ränilinna asum',
      leitud_osa: 'Apollo Kino Lõunakeskus',
      kvaliteet: 'poi',
    })] });

    const [result] = await forwardGeocode('Lõunakeskus');
    expect(result.name).toBe('Apollo Kino Lõunakeskus, Lääneringtee 39, Ränilinna, Tartu linn');
    expect(result.display_name).toBe(result.name);
  });

  it('ignores leitud_osa on a row that is not a place match', async () => {
    mockFetch({ inAdsAddresses: [inAdsRow({ leitud_osa: 'Võru', kvaliteet: 'tapne_nr' })] });

    const [result] = await forwardGeocode('Võru tn 30');
    expect(result.name).toBe('Võru tn 30, Riiamäe, Tartu linn');
  });

  it('keeps two different places that share an address', async () => {
    const atRiia1 = (leitud_osa) => inAdsRow({
      aadresstekst: 'Riia tn 1', asum: '', leitud_osa, kvaliteet: 'poi',
    });
    mockFetch({ inAdsAddresses: [atRiia1('Tartu Kaubamaja'), atRiia1('Apollo'), atRiia1('Tartu Kaubamaja')] });

    const results = await forwardGeocode('Riia tn 1');
    expect(results.map(r => r.name)).toEqual([
      'Tartu Kaubamaja, Riia tn 1, Tartu linn',
      'Apollo, Riia tn 1, Tartu linn',
    ]);
  });

  it('returns at most 5 results', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => inAdsRow({ aadresstekst: `Riia tn ${i + 1}` }));
    mockFetch({ inAdsAddresses: rows });

    expect(await forwardGeocode('Riia')).toHaveLength(5);
  });

  it('does not ask Nominatim when In-ADS found something', async () => {
    mockFetch({ inAdsAddresses: [inAdsRow()], nominatimResults: [nominatimHit()] });

    await forwardGeocode('Võru tn 30');
    expect(nominatim).toHaveLength(0);
  });
});

describe('forwardGeocode falling back to Nominatim', () => {
  it('asks Nominatim when In-ADS has no answer', async () => {
    mockFetch({
      inAdsAddresses: [],
      nominatimResults: [nominatimHit({
        address: { house_number: '30', road: 'Võru', suburb: 'Riiamäe', city: 'Tartu' },
      })],
    });

    const [result] = await forwardGeocode('Voru 30');
    expect(inAds).toHaveLength(1);
    expect(nominatim).toHaveLength(1);
    expect(result.name).toBe('Võru 30, Riiamäe, Tartu');
  });

  it('asks Nominatim when In-ADS fails', async () => {
    mockFetch({
      inAdsError: new TypeError('Failed to fetch'),
      nominatimResults: [nominatimHit({ address: { road: 'Riia', house_number: '2', city: 'Tartu' } })],
    });

    const [result] = await forwardGeocode('Riia 2');
    expect(nominatim).toHaveLength(1);
    expect(result.name).toBe('Riia 2, Tartu');
  });

  it('returns nothing when neither service finds anything', async () => {
    mockFetch({ inAdsAddresses: [], nominatimResults: [] });

    expect(await forwardGeocode('qqqq')).toEqual([]);
  });

  it('searches nothing at all for a one-character query', async () => {
    mockFetch({ inAdsAddresses: [inAdsRow()] });

    expect(await forwardGeocode('V')).toEqual([]);
    expect(inAds).toHaveLength(0);
    expect(nominatim).toHaveLength(0);
  });
});

describe('Nominatim short label', () => {
  const viaNominatim = async (hit) => {
    mockFetch({ inAdsAddresses: [], nominatimResults: [hit] });
    const [result] = await forwardGeocode('whatever');
    return result;
  };

  it('shortens a street address to street, suburb, city', async () => {
    const result = await viaNominatim(nominatimHit({
      address: { house_number: '30', road: 'Võru', suburb: 'Riiamäe', city: 'Tartu', country: 'Eesti' },
    }));

    expect(result.name).toBe('Võru 30, Riiamäe, Tartu');
    // The full postal address is still there for anyone who wants it
    expect(result.display_name).toBe('30, Võru, Riiamäe, Kesklinn, Tartu linn, Tartu maakond, 51010, Eesti');
    expect(result.lat).toBe(58.3722);
  });

  it('leads with the place name for a named place', async () => {
    const result = await viaNominatim(nominatimHit({
      name: 'Lõunakeskus',
      addresstype: 'shop',
      type: 'mall',
      display_name: 'Lõunakeskus, 37, Lääneringtee, Ränilinn, Tartu linn, Tartu maakond, 61715, Eesti',
      address: { shop: 'Lõunakeskus', house_number: '37', road: 'Lääneringtee', suburb: 'Ränilinn' },
    }));

    expect(result.name).toBe('Lõunakeskus, Lääneringtee 37, Ränilinn');
  });

  it('does not repeat the street name when the result is the street itself', async () => {
    const result = await viaNominatim(nominatimHit({
      name: 'Võru',
      addresstype: 'road',
      type: 'residential',
      address: { road: 'Võru', suburb: 'Riiamäe', city: 'Tartu' },
    }));

    expect(result.name).toBe('Võru, Riiamäe, Tartu');
  });

  it('falls back to display_name when there are no usable address parts', async () => {
    const withoutParts = await viaNominatim(nominatimHit({ address: { postcode: '51010', country: 'Eesti' } }));
    expect(withoutParts.name).toBe(withoutParts.display_name);

    const withoutAddress = await viaNominatim(nominatimHit({ address: undefined }));
    expect(withoutAddress.name).toBe(withoutAddress.display_name);
  });
});
