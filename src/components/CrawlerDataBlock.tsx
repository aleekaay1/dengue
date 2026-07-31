import React from 'react';
import type { CityConditions, ZoneData } from '../types';

interface CrawlerDataBlockProps {
  zones: ZoneData[];
  cityConditions: CityConditions;
  builtAt?: string | null;
}

/**
 * Always present in the HTML (including SSR) so crawlers / AI agents can read
 * zone scores without executing JavaScript. Visually hidden for sighted users.
 */
export const CrawlerDataBlock: React.FC<CrawlerDataBlockProps> = ({
  zones,
  cityConditions,
  builtAt,
}) => {
  const sorted = [...zones].sort((a, b) => b.riskScore - a.riskScore);

  return (
    <section className="sr-only" aria-label="Islamabad dengue surveillance data">
      <h1>
        Dengue Surveillance Dashboard — {cityConditions.cityName},{' '}
        {cityConditions.province}
      </h1>
      <p>
        Adult Aedes biting activity risk for Islamabad Capital Territory. Field
        conditions on {cityConditions.date}: temperature{' '}
        {cityConditions.temperature}°C, humidity {cityConditions.humidity}%,
        rainfall {cityConditions.rainfall} mm (48h), average NDVI{' '}
        {cityConditions.averageNDVI}.{' '}
        {cityConditions.activeHighRiskZones} of{' '}
        {cityConditions.totalZonesMonitored} zones are high risk. Alert status:{' '}
        {cityConditions.seasonalAlertStatus}.
        {builtAt ? ` Built at ${builtAt}.` : ''}
      </p>
      <h2>Zone risk ranking</h2>
      <table>
        <thead>
          <tr>
            <th>Zone</th>
            <th>District</th>
            <th>Tehsil</th>
            <th>Area</th>
            <th>Risk level</th>
            <th>Risk score</th>
            <th>Temperature C</th>
            <th>Humidity %</th>
            <th>Rainfall mm</th>
            <th>NDVI</th>
            <th>Recent weekly cases</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((z) => (
            <tr key={z.id}>
              <td>{z.name}</td>
              <td>{z.district}</td>
              <td>{z.tehsil}</td>
              <td>{z.areaType}</td>
              <td>{z.riskLevel}</td>
              <td>{z.riskScore}</td>
              <td>{z.temperature}</td>
              <td>{z.humidity}</td>
              <td>{z.rainfallRecent}</td>
              <td>{z.vegetationIndex}</td>
              <td>{z.pastCases.at(-1)?.count ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};
