/**
 * Travel routes database
 * Contains all travel routes between locations
 */

import type { TravelRoute } from '../models/Location';
import { TRAVEL_TIERS } from '../models/constants';

/**
 * Base travel routes (reverse routes are generated automatically)
 */
export const BASE_ROUTES: TravelRoute[] = [
  // Main City connections
  {
    id: 'main_city_to_forest_town',
    from: 'main_city',
    to: 'forest_town',
    distance: 'short',
    baseTravelTime: TRAVEL_TIERS.SHORT,
    energyCost: 10,
    routeType: 'road',
    safety: 'safe',
  },
  {
    id: 'main_city_to_mountain_village',
    from: 'main_city',
    to: 'mountain_village',
    distance: 'medium',
    baseTravelTime: TRAVEL_TIERS.MEDIUM,
    energyCost: 20,
    routeType: 'road',
    safety: 'moderate',
  },
  {
    id: 'main_city_to_forest',
    from: 'main_city',
    to: 'forest',
    distance: 'short',
    baseTravelTime: TRAVEL_TIERS.SHORT,
    energyCost: 10,
    routeType: 'path',
    safety: 'moderate',
  },
  {
    id: 'main_city_to_lake',
    from: 'main_city',
    to: 'lake',
    distance: 'medium',
    baseTravelTime: TRAVEL_TIERS.MEDIUM,
    energyCost: 20,
    routeType: 'path',
    safety: 'safe',
  },

  // Forest Town connections
  {
    id: 'forest_town_to_forest',
    from: 'forest_town',
    to: 'forest',
    distance: 'instant',
    baseTravelTime: TRAVEL_TIERS.INSTANT,
    energyCost: 0,
    routeType: 'path',
    safety: 'safe',
  },
  {
    id: 'forest_town_to_lake',
    from: 'forest_town',
    to: 'lake',
    distance: 'short',
    baseTravelTime: TRAVEL_TIERS.SHORT,
    energyCost: 10,
    routeType: 'path',
    safety: 'safe',
  },

  // Mountain Village connections
  {
    id: 'mountain_village_to_mountains',
    from: 'mountain_village',
    to: 'mountains',
    distance: 'instant',
    baseTravelTime: TRAVEL_TIERS.INSTANT,
    energyCost: 0,
    routeType: 'path',
    safety: 'moderate',
  },

  // Forest to Mountains (wilderness route)
  {
    id: 'forest_to_mountains',
    from: 'forest',
    to: 'mountains',
    distance: 'long',
    baseTravelTime: TRAVEL_TIERS.LONG,
    energyCost: 35,
    routeType: 'wilderness',
    safety: 'dangerous',
    encounters: [
      {
        type: 'battle',
        chance: 30,
        pool: ['wild_encounter_1', 'wild_encounter_2'],
      },
    ],
  },
];

/**
 * Generate reverse routes from base routes
 */
function generateReverseRoutes(baseRoutes: TravelRoute[]): TravelRoute[] {
  return baseRoutes.map((route) => ({
    ...route,
    id: `${route.id}_reverse`,
    from: route.to,
    to: route.from,
  }));
}

/**
 * All travel routes including reverse routes
 */
export const ALL_ROUTES: TravelRoute[] = [...BASE_ROUTES, ...generateReverseRoutes(BASE_ROUTES)];

/**
 * Routes map for quick lookup
 */
export const ROUTES_MAP: Map<string, TravelRoute> = new Map(
  ALL_ROUTES.map((route) => [`${route.from}_${route.to}`, route]),
);

/**
 * Get a route between two locations
 */
export function getRoute(from: string, to: string): TravelRoute | undefined {
  return ROUTES_MAP.get(`${from}_${to}`) || undefined;
}

/**
 * Get all routes from a specific location
 */
export function getRoutesFrom(locationId: string): TravelRoute[] {
  return ALL_ROUTES.filter((route) => route.from === locationId);
}

/**
 * Get all routes to a specific location
 */
export function getRoutesTo(locationId: string): TravelRoute[] {
  return ALL_ROUTES.filter((route) => route.to === locationId);
}

/**
 * Get all routes with specific safety level
 */
export function getRoutesBySafety(safety: 'safe' | 'moderate' | 'dangerous'): TravelRoute[] {
  return ALL_ROUTES.filter((route) => route.safety === safety);
}

/**
 * Get all routes with specific route type
 */
export function getRoutesByType(routeType: 'road' | 'path' | 'wilderness'): TravelRoute[] {
  return ALL_ROUTES.filter((route) => route.routeType === routeType);
}

/**
 * Get all connected locations from a specific location
 */
export function getConnectedLocations(locationId: string): string[] {
  const destinations = new Set<string>();
  ALL_ROUTES.forEach((route) => {
    if (route.from === locationId) {
      destinations.add(route.to);
    }
  });
  return Array.from(destinations);
}

/**
 * Check if a route exists between two locations
 */
export function hasRoute(from: string, to: string): boolean {
  return ROUTES_MAP.has(`${from}_${to}`);
}

/**
 * Get all routes with encounters
 */
export function getRoutesWithEncounters(): TravelRoute[] {
  return ALL_ROUTES.filter((route) => route.encounters && route.encounters.length > 0);
}

/**
 * Get instant travel routes (no travel time)
 */
export function getInstantRoutes(): TravelRoute[] {
  return ALL_ROUTES.filter((route) => route.distance === 'instant');
}
