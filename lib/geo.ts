// Where supporters are, for the map: [latitude, longitude] per city we know, and a centroid per
// country as the fallback. Gifts from an unknown place get no dot.
const CITY: Record<string, [number, number]> = {
  Toronto: [43.65, -79.38], Calgary: [51.05, -114.07], Vancouver: [49.28, -123.12], Montreal: [45.5, -73.57], Ottawa: [45.42, -75.7], Halifax: [44.65, -63.58],
  Austin: [30.27, -97.74], Seattle: [47.61, -122.33], Chicago: [41.88, -87.63], Boston: [42.36, -71.06], 'New York': [40.71, -74.0],
  Mumbai: [19.08, 72.88], Karachi: [24.86, 67.0], Manila: [14.6, 120.98], Lagos: [6.52, 3.38], Nairobi: [-1.29, 36.82], 'Mexico City': [19.43, -99.13], Dubai: [25.2, 55.27],
  Berlin: [52.52, 13.4], Lyon: [45.76, 4.84], Dublin: [53.35, -6.26], Utrecht: [52.09, 5.12], Valencia: [39.47, -0.38], Turin: [45.07, 7.69],
  London: [51.51, -0.13], Leeds: [53.8, -1.55], Manchester: [53.48, -2.24], Glasgow: [55.86, -4.25],
  Sydney: [-33.87, 151.21], Melbourne: [-37.81, 144.96], Auckland: [-36.85, 174.76],
};
const COUNTRY: Record<string, [number, number]> = {
  CA: [56, -106], US: [39, -98], MX: [23, -102], BR: [-10, -52], GB: [54, -2], IE: [53, -8], DE: [51, 10], FR: [46, 2], NL: [52, 5], ES: [40, -4], IT: [42, 12],
  IN: [21, 78], PK: [30, 70], PH: [12, 122], JP: [36, 138], AE: [24, 54], NG: [9, 8], KE: [0, 38], ZA: [-29, 24], AU: [-25, 134], NZ: [-41, 174],
};
export function coordsFor(city?: string | null, countryCode?: string | null): [number, number] | null {
  return (city && CITY[city]) || (countryCode && COUNTRY[countryCode]) || null;
}
