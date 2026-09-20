export type Region =
  | "Africa"
  | "Asia"
  | "Europe"
  | "Middle East"
  | "North America"
  | "South America"
  | "Oceania";

type CountryPoint = {
  latitude: number;
  longitude: number;
  region: Region;
};

/**
 * Country centroids are used only when GDELT provides a source country but no
 * incident coordinates. The UI labels these markers as source-country estimates.
 */
const COUNTRY_POINTS: Record<string, CountryPoint> = {
  "united states": { latitude: 39.8, longitude: -98.6, region: "North America" },
  canada: { latitude: 56.1, longitude: -106.3, region: "North America" },
  mexico: { latitude: 23.6, longitude: -102.5, region: "North America" },
  brazil: { latitude: -10.8, longitude: -52.9, region: "South America" },
  argentina: { latitude: -38.4, longitude: -63.6, region: "South America" },
  colombia: { latitude: 4.6, longitude: -74.3, region: "South America" },
  venezuela: { latitude: 7.0, longitude: -66.2, region: "South America" },
  chile: { latitude: -33.5, longitude: -70.7, region: "South America" },
  peru: { latitude: -9.2, longitude: -75.0, region: "South America" },
  "united kingdom": { latitude: 54.7, longitude: -3.4, region: "Europe" },
  france: { latitude: 46.2, longitude: 2.2, region: "Europe" },
  germany: { latitude: 51.2, longitude: 10.4, region: "Europe" },
  italy: { latitude: 42.8, longitude: 12.8, region: "Europe" },
  spain: { latitude: 40.5, longitude: -3.7, region: "Europe" },
  poland: { latitude: 52.1, longitude: 19.4, region: "Europe" },
  russia: { latitude: 61.5, longitude: 90.0, region: "Europe" },
  ukraine: { latitude: 49.0, longitude: 31.4, region: "Europe" },
  turkey: { latitude: 39.0, longitude: 35.2, region: "Middle East" },
  israel: { latitude: 31.5, longitude: 34.8, region: "Middle East" },
  palestine: { latitude: 31.9, longitude: 35.2, region: "Middle East" },
  iran: { latitude: 32.4, longitude: 53.7, region: "Middle East" },
  iraq: { latitude: 33.2, longitude: 43.7, region: "Middle East" },
  syria: { latitude: 35.0, longitude: 38.5, region: "Middle East" },
  lebanon: { latitude: 33.9, longitude: 35.9, region: "Middle East" },
  "saudi arabia": { latitude: 24.0, longitude: 45.0, region: "Middle East" },
  "united arab emirates": { latitude: 23.4, longitude: 53.8, region: "Middle East" },
  egypt: { latitude: 26.8, longitude: 30.8, region: "Africa" },
  sudan: { latitude: 15.5, longitude: 30.2, region: "Africa" },
  "south sudan": { latitude: 7.9, longitude: 30.0, region: "Africa" },
  ethiopia: { latitude: 9.1, longitude: 40.5, region: "Africa" },
  somalia: { latitude: 5.2, longitude: 46.2, region: "Africa" },
  kenya: { latitude: 0.2, longitude: 37.9, region: "Africa" },
  uganda: { latitude: 1.4, longitude: 32.3, region: "Africa" },
  tanzania: { latitude: -6.4, longitude: 34.9, region: "Africa" },
  rwanda: { latitude: -1.9, longitude: 29.9, region: "Africa" },
  "democratic republic of the congo": {
    latitude: -2.9,
    longitude: 23.7,
    region: "Africa",
  },
  congo: { latitude: -0.7, longitude: 15.8, region: "Africa" },
  nigeria: { latitude: 9.1, longitude: 8.7, region: "Africa" },
  ghana: { latitude: 7.9, longitude: -1.0, region: "Africa" },
  senegal: { latitude: 14.5, longitude: -14.5, region: "Africa" },
  mali: { latitude: 17.6, longitude: -4.0, region: "Africa" },
  "burkina faso": { latitude: 12.2, longitude: -1.6, region: "Africa" },
  niger: { latitude: 17.6, longitude: 8.1, region: "Africa" },
  morocco: { latitude: 31.8, longitude: -7.1, region: "Africa" },
  algeria: { latitude: 28.0, longitude: 1.7, region: "Africa" },
  libya: { latitude: 26.3, longitude: 17.2, region: "Africa" },
  "south africa": { latitude: -30.6, longitude: 22.9, region: "Africa" },
  china: { latitude: 35.9, longitude: 104.2, region: "Asia" },
  india: { latitude: 21.1, longitude: 78.0, region: "Asia" },
  pakistan: { latitude: 30.4, longitude: 69.3, region: "Asia" },
  bangladesh: { latitude: 23.7, longitude: 90.4, region: "Asia" },
  japan: { latitude: 36.2, longitude: 138.3, region: "Asia" },
  "south korea": { latitude: 36.5, longitude: 127.9, region: "Asia" },
  "north korea": { latitude: 40.3, longitude: 127.5, region: "Asia" },
  afghanistan: { latitude: 33.9, longitude: 67.7, region: "Asia" },
  indonesia: { latitude: -2.5, longitude: 118.0, region: "Asia" },
  philippines: { latitude: 12.9, longitude: 121.8, region: "Asia" },
  vietnam: { latitude: 14.1, longitude: 108.3, region: "Asia" },
  thailand: { latitude: 15.9, longitude: 100.9, region: "Asia" },
  myanmar: { latitude: 21.9, longitude: 95.9, region: "Asia" },
  australia: { latitude: -25.3, longitude: 133.8, region: "Oceania" },
  "new zealand": { latitude: -41.2, longitude: 174.8, region: "Oceania" },
};

export function countryPoint(country: string): CountryPoint | null {
  return COUNTRY_POINTS[country.trim().toLowerCase()] ?? null;
}

