import type { Coordinates, Point } from "./radar-types.ts";

const SEMI_MAJOR_AXIS = 6_378_137;
const INVERSE_FLATTENING = 298.257222101;
const FLATTENING = 1 / INVERSE_FLATTENING;
const ECCENTRICITY = Math.sqrt(2 * FLATTENING - FLATTENING ** 2);
const LATITUDE_OF_ORIGIN = degreesToRadians(57.51755393055556);
const CENTRAL_MERIDIAN = degreesToRadians(24);
const FIRST_STANDARD_PARALLEL = degreesToRadians(59.33333333333334);
const SECOND_STANDARD_PARALLEL = degreesToRadians(58);
const FALSE_EASTING = 500_000;
const FALSE_NORTHING = 6_375_000;
const INVERSE_ITERATIONS = 12;

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function m(latitude: number): number {
  const sine = Math.sin(latitude);
  return Math.cos(latitude) / Math.sqrt(1 - ECCENTRICITY ** 2 * sine ** 2);
}

function t(latitude: number): number {
  const eccentricSine = ECCENTRICITY * Math.sin(latitude);
  return Math.tan(Math.PI / 4 - latitude / 2)
    / ((1 - eccentricSine) / (1 + eccentricSine)) ** (ECCENTRICITY / 2);
}

const FIRST_M = m(FIRST_STANDARD_PARALLEL);
const SECOND_M = m(SECOND_STANDARD_PARALLEL);
const FIRST_T = t(FIRST_STANDARD_PARALLEL);
const SECOND_T = t(SECOND_STANDARD_PARALLEL);
const N = Math.log(FIRST_M / SECOND_M) / Math.log(FIRST_T / SECOND_T);
const F = FIRST_M / (N * FIRST_T ** N);
const ORIGIN_RHO = SEMI_MAJOR_AXIS * F * t(LATITUDE_OF_ORIGIN) ** N;

/** WGS84 longitude/latitude to the official L-EST97 (EPSG:3301) map grid. */
export function projectToLest(coordinates: Coordinates): Point {
  const latitude = degreesToRadians(coordinates.latitude);
  const longitude = degreesToRadians(coordinates.longitude);
  const rho = SEMI_MAJOR_AXIS * F * t(latitude) ** N;
  const theta = N * (longitude - CENTRAL_MERIDIAN);

  return {
    x: FALSE_EASTING + rho * Math.sin(theta),
    y: FALSE_NORTHING + ORIGIN_RHO - rho * Math.cos(theta),
  };
}

/** Official L-EST97 (EPSG:3301) easting/northing back to WGS84. */
export function unprojectFromLest(point: Point): Coordinates {
  const deltaX = point.x - FALSE_EASTING;
  const deltaY = ORIGIN_RHO - (point.y - FALSE_NORTHING);
  const rho = Math.hypot(deltaX, deltaY) * Math.sign(N);
  const theta = Math.atan2(deltaX, deltaY);
  const targetT = (rho / (SEMI_MAJOR_AXIS * F)) ** (1 / N);
  let latitude = Math.PI / 2 - 2 * Math.atan(targetT);

  for (let index = 0; index < INVERSE_ITERATIONS; index += 1) {
    const eccentricSine = ECCENTRICITY * Math.sin(latitude);
    const nextLatitude = Math.PI / 2 - 2 * Math.atan(
      targetT * ((1 - eccentricSine) / (1 + eccentricSine)) ** (ECCENTRICITY / 2),
    );
    if (Math.abs(nextLatitude - latitude) < 1e-13) {
      latitude = nextLatitude;
      break;
    }
    latitude = nextLatitude;
  }

  return {
    latitude: radiansToDegrees(latitude),
    longitude: radiansToDegrees(CENTRAL_MERIDIAN + theta / N),
  };
}
