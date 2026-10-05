'use strict';

const cache = new Map();

async function getForecast({ latitude, longitude, kickoff }) {
  if (![latitude, longitude, kickoff].every(Number.isFinite) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
      kickoff <= 0) {
    throw new Error('Valid stadium coordinates and kickoff required.');
  }

  const now = Date.now();

  if (kickoff < now) {
    return {
      available: false,
      message: 'Kickoff has passed. Historical weather is not connected.'
    };
  }

  if (kickoff > now + 15 * 86400000) {
    return {
      available: false,
      message: 'Check again within 15 days of kickoff for a forecast.'
    };
  }

  const key = `${latitude}:${longitude}:${kickoff}`;
  const saved = cache.get(key);
  if (saved && now - saved.fetchedAt < 15 * 60000) {
    return saved;
  }

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: [
      'temperature_2m',
      'wind_speed_10m',
      'wind_gusts_10m',
      'precipitation_probability'
    ].join(','),
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'GMT',
    timeformat: 'unixtime',
    forecast_days: '16'
  });

  const response = await fetch(
    'https://api.open-meteo.com/v1/forecast?' + params,
    { signal: AbortSignal.timeout(15000) }
  );

  if (!response.ok) throw new Error('Weather service temporarily unavailable.');

  const data = await response.json();
  const hourly = data.hourly;

  if (data.error || !Array.isArray(hourly?.time)) {
    throw new Error('Weather service returned no hourly forecast.');
  }

  let index = -1;
  let closest = Infinity;

  hourly.time.forEach((time, i) => {
    if (!Number.isFinite(time)) return;
    const distance = Math.abs(time * 1000 - kickoff);
    if (distance < closest) {
      closest = distance;
      index = i;
    }
  });

  if (index < 0 || closest > 30 * 60000) {
    return {
      available: false,
      message: 'No forecast hour close enough to kickoff is available.'
    };
  }

  const value = name => {
    const number = hourly[name]?.[index];
    return Number.isFinite(number) ? number : null;
  };

  const result = {
    available: true,
    source: 'Open-Meteo',
    fetchedAt: Date.now(),
    forecastTime: hourly.time[index] * 1000,
    temperatureF: value('temperature_2m'),
    windMph: value('wind_speed_10m'),
    gustMph: value('wind_gusts_10m'),
    precipitationChance: value('precipitation_probability')
  };

  if (cache.size >= 250) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
}

module.exports = { getForecast };
