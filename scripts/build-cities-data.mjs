import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cities from 'all-the-cities';
import countries from 'i18n-iso-countries';
import ko from 'i18n-iso-countries/langs/ko.json' with { type: 'json' };

countries.registerLocale(ko);

const round = (n) => Math.round(n * 10000) / 10000;
const POPULATION_FLOOR = 200000;

const byId = new Map();
for (const c of cities) {
  if (c.featureCode !== 'PPLC' && c.population < POPULATION_FLOOR) continue;
  byId.set(c.cityId, c);
}

const result = [...byId.values()]
  .sort((a, b) => b.population - a.population || a.name.localeCompare(b.name))
  .map((c) => ({
    id: String(c.cityId),
    name: c.name,
    country: countries.getName(c.country, 'ko') ?? c.country,
    lat: round(c.loc.coordinates[1]),
    lng: round(c.loc.coordinates[0]),
  }));

writeFileSync(fileURLToPath(new URL('../src/data/cities.json', import.meta.url)), JSON.stringify(result));
console.log(`Wrote ${result.length} cities`);
