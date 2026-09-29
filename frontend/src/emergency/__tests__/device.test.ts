import { describe, expect, it } from 'vitest';
import { b64ToUint8, bearing, compass, distanceM, fmtDistance, freshness } from '../device';

describe('geo helpers', () => {
  const kalpetta: [number, number] = [76.083, 11.61];
  it('computes great-circle distance', () => {
    const north1km: [number, number] = [76.083, 11.61 + 1000 / 110574];
    expect(distanceM(kalpetta, north1km)).toBeGreaterThan(995);
    expect(distanceM(kalpetta, north1km)).toBeLessThan(1010);
    expect(distanceM(kalpetta, kalpetta)).toBe(0);
  });
  it('computes bearing and compass direction', () => {
    expect(compass(bearing(kalpetta, [76.083, 11.7]))).toBe('N');
    expect(compass(bearing(kalpetta, [76.2, 11.61]))).toBe('E');
    expect(compass(bearing(kalpetta, [76.0, 11.53]))).toBe('SW');
  });
  it('formats distances', () => {
    expect(fmtDistance(420.4)).toBe('420 m');
    expect(fmtDistance(2450)).toBe('2.5 km');
    expect(fmtDistance(23800)).toBe('24 km');
  });
  it('classifies location freshness', () => {
    expect(freshness(null)).toBe('PERMISSION_REQUIRED');
    expect(freshness(new Date(Date.now() - 60_000).toISOString(), 15)).toBe('CONNECTED');
    expect(freshness(new Date(Date.now() - 20 * 60_000).toISOString(), 15)).toBe('STALE');
  });
});

describe('VAPID key decoding', () => {
  it('decodes an unpadded base64url P-256 public key to 65 bytes', () => {
    const key = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';
    const b = b64ToUint8(key);
    expect(b.length).toBe(65);
    expect(b[0]).toBe(0x04); // uncompressed point
  });
});
