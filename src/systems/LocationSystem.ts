import { BaseSystem, type SystemInitOptions, type SystemError } from './BaseSystem';
import type { GameState, GameUpdate } from '../models';
import type {
  Location,
  CityLocation,
  WildLocation,
  TravelRoute,
  LocationState,
} from '../models/Location';
import {
  UPDATE_TYPES,
  LOCATION_TYPES,
  CITY_AREAS,
  WILD_BIOMES,
  TRAVEL_TIERS,
  type TravelDistance,
  type GrowthStage,
  type CityArea,
} from '../models/constants';

export interface TravelInfo {
  from: string;
  to: string;
  distance: TravelDistance;
  duration: number; // minutes
  energyCost: number;
  route?: TravelRoute;
}

export interface TravelModifiers {
  injured?: boolean;
  speedItem?: string;
  weatherPenalty?: number;
}

export class LocationSystem extends BaseSystem {
  private locations: Map<string, Location | CityLocation | WildLocation> = new Map();
  private routes: Map<string, TravelRoute> = new Map();
  private currentLocationState: LocationState | null = null;
  private travelTimer: NodeJS.Timeout | null = null;

  constructor() {
    super('LocationSystem');
    this.initializeLocations();
    this.initializeRoutes();
  }

  protected async onInitialize(_options: SystemInitOptions): Promise<void> {
    // Initialize location state if not present
    if (!this.currentLocationState) {
      this.currentLocationState = this.createDefaultLocationState();
    }
  }

  protected async onShutdown(): Promise<void> {
    // Clear any active travel timers
    if (this.travelTimer) {
      clearTimeout(this.travelTimer);
      this.travelTimer = null;
    }

    // Clear travel state on shutdown
    if (this.currentLocationState) {
      this.currentLocationState.traveling = false;
      this.currentLocationState.travelRoute = undefined;
    }
  }

  protected async onReset(): Promise<void> {
    this.currentLocationState = this.createDefaultLocationState();
    if (this.travelTimer) {
      clearTimeout(this.travelTimer);
      this.travelTimer = null;
    }
  }

  protected async onTick(_deltaTime: number, _gameState: GameState): Promise<void> {
    // Check if travel is complete
    if (this.currentLocationState?.traveling && this.currentLocationState.travelRoute) {
      const now = Date.now();
      const route = this.currentLocationState.travelRoute;

      if (now >= route.endTime) {
        // Travel complete
        this.completeTravelInternal();
      } else {
        // Update progress
        const elapsed = now - route.startTime;
        const total = route.endTime - route.startTime;
        route.progress = Math.min(1, elapsed / total);
      }
    }
  }

  protected async onUpdate(gameState: GameState, _prevState?: GameState): Promise<void> {
    // Update location state from game state if needed
    if (gameState.world?.currentLocation) {
      this.currentLocationState = gameState.world.currentLocation;
    }
  }

  protected onError(error: SystemError): void {
    console.error(`[LocationSystem] Error: ${error.error.message}`);
  }

  private initializeLocations(): void {
    // Initialize cities
    const mainCity: CityLocation = {
      id: 'main_city',
      name: 'Main City',
      description: 'The bustling central hub of the region',
      type: LOCATION_TYPES.CITY,
      sprite: 'sprites/locations/main_city.png',
      lightingType: 'day',
      areas: {
        [CITY_AREAS.SQUARE]: {
          available: true,
          name: 'Town Square',
          description: 'The heart of the city where pets gather',
          sprite: 'sprites/locations/town_square.png',
          npcCount: 5,
        },
        [CITY_AREAS.SHOP]: {
          available: true,
          name: 'General Store',
          description: 'Buy and sell various items',
          sprite: 'sprites/locations/shop.png',
          npcCount: 1,
        },
        [CITY_AREAS.GYM]: {
          available: true,
          name: 'Training Gym',
          description: 'Train your pet to become stronger',
          sprite: 'sprites/locations/gym.png',
          npcCount: 3,
        },
        [CITY_AREAS.ARENA]: {
          available: true,
          name: 'Battle Arena',
          description: 'Test your skills in battle',
          sprite: 'sprites/locations/arena.png',
          npcCount: 2,
        },
      },
      population: 'large',
      prosperityLevel: 8,
      hasShop: true,
      hasArena: true,
      hasGym: true,
      hasInn: true,
    };

    const forestTown: CityLocation = {
      id: 'forest_town',
      name: 'Forest Town',
      description: 'A peaceful town surrounded by trees',
      type: LOCATION_TYPES.CITY,
      sprite: 'sprites/locations/forest_town.png',
      lightingType: 'day',
      areas: {
        [CITY_AREAS.SQUARE]: {
          available: true,
          name: 'Village Center',
          description: 'A quiet meeting place',
          sprite: 'sprites/locations/village_center.png',
          npcCount: 3,
        },
        [CITY_AREAS.SHOP]: {
          available: true,
          name: 'Forest Shop',
          description: 'Specializes in nature items',
          sprite: 'sprites/locations/forest_shop.png',
          npcCount: 1,
        },
      },
      population: 'small',
      prosperityLevel: 5,
      hasShop: true,
      hasArena: false,
      hasGym: false,
      hasInn: true,
    };

    const mountainVillage: CityLocation = {
      id: 'mountain_village',
      name: 'Mountain Village',
      description: 'A hardy village high in the mountains',
      type: LOCATION_TYPES.CITY,
      sprite: 'sprites/locations/mountain_village.png',
      lightingType: 'day',
      areas: {
        [CITY_AREAS.SQUARE]: {
          available: true,
          name: 'Mountain Plaza',
          description: 'A stone plaza with mountain views',
          sprite: 'sprites/locations/mountain_plaza.png',
          npcCount: 4,
        },
        [CITY_AREAS.SHOP]: {
          available: true,
          name: 'Mining Supplies',
          description: 'Tools and minerals',
          sprite: 'sprites/locations/mining_shop.png',
          npcCount: 1,
        },
        [CITY_AREAS.GYM]: {
          available: true,
          name: 'Mountain Gym',
          description: 'Train in harsh conditions',
          sprite: 'sprites/locations/mountain_gym.png',
          npcCount: 2,
        },
      },
      population: 'medium',
      prosperityLevel: 6,
      hasShop: true,
      hasArena: false,
      hasGym: true,
      hasInn: true,
    };

    // Initialize wild locations
    const forest: WildLocation = {
      id: 'forest',
      name: 'Dense Forest',
      description: 'A thick forest full of life',
      type: LOCATION_TYPES.WILD,
      sprite: 'sprites/locations/forest.png',
      lightingType: 'day',
      biome: WILD_BIOMES.FOREST,
      dangerLevel: 3,
      explorationDifficulty: 'easy',
      availableActivities: ['FISHING', 'FORAGING'],
      resources: {
        abundant: ['wood', 'berries', 'mushrooms'],
        rare: ['rare_flower', 'ancient_seed'],
        exclusive: ['forest_gem'],
      },
      wildPetSpecies: [
        {
          speciesId: 'forest_sprite',
          encounterRate: 30,
          level: { min: 5, max: 15 },
        },
        {
          speciesId: 'tree_guardian',
          encounterRate: 10,
          level: { min: 10, max: 20 },
        },
      ],
    };

    const mountains: WildLocation = {
      id: 'mountains',
      name: 'Rocky Mountains',
      description: 'Towering peaks with valuable minerals',
      type: LOCATION_TYPES.WILD,
      sprite: 'sprites/locations/mountains.png',
      lightingType: 'day',
      biome: WILD_BIOMES.MOUNTAINS,
      dangerLevel: 6,
      explorationDifficulty: 'hard',
      availableActivities: ['MINING', 'FORAGING'],
      resources: {
        abundant: ['stone', 'iron_ore'],
        rare: ['gold_ore', 'crystal'],
        exclusive: ['mountain_ruby'],
      },
      wildPetSpecies: [
        {
          speciesId: 'rock_golem',
          encounterRate: 25,
          level: { min: 15, max: 30 },
        },
        {
          speciesId: 'sky_eagle',
          encounterRate: 15,
          level: { min: 20, max: 35 },
        },
      ],
      hazards: [
        {
          type: 'extreme_cold',
          chance: 20,
          effect: 'Reduces energy regeneration',
        },
      ],
    };

    const lake: WildLocation = {
      id: 'lake',
      name: 'Crystal Lake',
      description: 'A pristine lake with abundant fish',
      type: LOCATION_TYPES.WILD,
      sprite: 'sprites/locations/lake.png',
      lightingType: 'day',
      biome: WILD_BIOMES.LAKE,
      dangerLevel: 2,
      explorationDifficulty: 'easy',
      availableActivities: ['FISHING', 'FORAGING'],
      resources: {
        abundant: ['fish', 'water_plants'],
        rare: ['pearl', 'rare_fish'],
        exclusive: ['lake_crystal'],
      },
      wildPetSpecies: [
        {
          speciesId: 'water_sprite',
          encounterRate: 35,
          level: { min: 5, max: 15 },
        },
      ],
    };

    // Add all locations to the map
    this.locations.set('main_city', mainCity);
    this.locations.set('forest_town', forestTown);
    this.locations.set('mountain_village', mountainVillage);
    this.locations.set('forest', forest);
    this.locations.set('mountains', mountains);
    this.locations.set('lake', lake);
  }

  private initializeRoutes(): void {
    // Main City connections
    this.addRoute({
      id: 'main_city_to_forest_town',
      from: 'main_city',
      to: 'forest_town',
      distance: 'short',
      baseTravelTime: TRAVEL_TIERS.SHORT,
      energyCost: 10,
      routeType: 'road',
      safety: 'safe',
    });

    this.addRoute({
      id: 'main_city_to_mountain_village',
      from: 'main_city',
      to: 'mountain_village',
      distance: 'medium',
      baseTravelTime: TRAVEL_TIERS.MEDIUM,
      energyCost: 20,
      routeType: 'road',
      safety: 'moderate',
    });

    this.addRoute({
      id: 'main_city_to_forest',
      from: 'main_city',
      to: 'forest',
      distance: 'short',
      baseTravelTime: TRAVEL_TIERS.SHORT,
      energyCost: 10,
      routeType: 'path',
      safety: 'moderate',
    });

    this.addRoute({
      id: 'main_city_to_lake',
      from: 'main_city',
      to: 'lake',
      distance: 'medium',
      baseTravelTime: TRAVEL_TIERS.MEDIUM,
      energyCost: 20,
      routeType: 'path',
      safety: 'safe',
    });

    // Forest Town connections
    this.addRoute({
      id: 'forest_town_to_forest',
      from: 'forest_town',
      to: 'forest',
      distance: 'instant',
      baseTravelTime: TRAVEL_TIERS.INSTANT,
      energyCost: 0,
      routeType: 'path',
      safety: 'safe',
    });

    this.addRoute({
      id: 'forest_town_to_lake',
      from: 'forest_town',
      to: 'lake',
      distance: 'short',
      baseTravelTime: TRAVEL_TIERS.SHORT,
      energyCost: 10,
      routeType: 'path',
      safety: 'safe',
    });

    // Mountain Village connections
    this.addRoute({
      id: 'mountain_village_to_mountains',
      from: 'mountain_village',
      to: 'mountains',
      distance: 'instant',
      baseTravelTime: TRAVEL_TIERS.INSTANT,
      energyCost: 0,
      routeType: 'path',
      safety: 'moderate',
    });

    // Forest to Mountains (wilderness route)
    this.addRoute({
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
    });

    // Create reverse routes
    this.createReverseRoutes();
  }

  private addRoute(route: TravelRoute): void {
    const key = `${route.from}_${route.to}`;
    this.routes.set(key, route);
  }

  private createReverseRoutes(): void {
    const reverseRoutes: TravelRoute[] = [];

    this.routes.forEach((route) => {
      const reverseRoute: TravelRoute = {
        ...route,
        id: `${route.id}_reverse`,
        from: route.to,
        to: route.from,
      };
      reverseRoutes.push(reverseRoute);
    });

    reverseRoutes.forEach((route) => {
      const key = `${route.from}_${route.to}`;
      if (!this.routes.has(key)) {
        this.routes.set(key, route);
      }
    });
  }

  private createDefaultLocationState(): LocationState {
    return {
      currentLocationId: 'main_city',
      currentArea: CITY_AREAS.SQUARE,
      traveling: false,
      inActivity: false,
      visitedLocations: ['main_city'],
      lastVisitTimes: {
        main_city: Date.now(),
      },
    };
  }

  // Public methods

  getCurrentLocation(): Location | CityLocation | WildLocation | null {
    if (!this.currentLocationState) return null;
    return this.locations.get(this.currentLocationState.currentLocationId) || null;
  }

  getCurrentLocationId(): string | null {
    return this.currentLocationState?.currentLocationId || null;
  }

  getCurrentArea(): CityArea | undefined {
    return this.currentLocationState?.currentArea;
  }

  getLocation(locationId: string): Location | CityLocation | WildLocation | null {
    return this.locations.get(locationId) || null;
  }

  getAllLocations(): Map<string, Location | CityLocation | WildLocation> {
    return new Map(this.locations);
  }

  isTraveling(): boolean {
    return this.currentLocationState?.traveling || false;
  }

  getTravelInfo(from: string, to: string): TravelInfo | null {
    const key = `${from}_${to}`;
    const route = this.routes.get(key);

    if (!route) {
      return null;
    }

    return {
      from,
      to,
      distance: route.distance,
      duration: route.baseTravelTime,
      energyCost: route.energyCost,
      route,
    };
  }

  calculateTravelTime(baseTime: number, modifiers: TravelModifiers = {}): number {
    let time = baseTime;

    // Apply injury penalty (50% slower)
    if (modifiers.injured) {
      time = Math.round(time * 1.5);
    }

    // Apply speed item bonus (30% faster)
    if (modifiers.speedItem) {
      time = Math.round(time * 0.7);
    }

    // Apply weather penalty
    if (modifiers.weatherPenalty) {
      time = Math.round(time * (1 + modifiers.weatherPenalty));
    }

    return time;
  }

  calculateEnergyCost(baseCost: number, modifiers: TravelModifiers = {}): number {
    let cost = baseCost;

    // Injuries don't affect energy cost, just time
    // Speed items might reduce energy cost slightly
    if (modifiers.speedItem) {
      cost = Math.round(cost * 0.9);
    }

    return cost;
  }

  canTravel(
    to: string,
    playerEnergy: number,
    petStage?: GrowthStage,
  ): { canTravel: boolean; reason?: string } {
    if (this.currentLocationState?.traveling) {
      return { canTravel: false, reason: 'Already traveling' };
    }

    if (this.currentLocationState?.inActivity) {
      return { canTravel: false, reason: 'Currently in an activity' };
    }

    const from = this.currentLocationState?.currentLocationId;
    if (!from) {
      return { canTravel: false, reason: 'Current location unknown' };
    }

    const travelInfo = this.getTravelInfo(from, to);
    if (!travelInfo) {
      return { canTravel: false, reason: 'No route available' };
    }

    if (playerEnergy < travelInfo.energyCost) {
      return { canTravel: false, reason: 'Not enough energy' };
    }

    // Check stage requirements if any
    if (travelInfo.route?.requirements?.minStage && petStage) {
      const stageOrder = ['HATCHLING', 'JUVENILE', 'ADULT'];
      const requiredIndex = stageOrder.indexOf(travelInfo.route.requirements.minStage);
      const currentIndex = stageOrder.indexOf(petStage);

      if (currentIndex < requiredIndex) {
        return {
          canTravel: false,
          reason: `Pet must be at least ${travelInfo.route.requirements.minStage}`,
        };
      }
    }

    return { canTravel: true };
  }

  startTravel(to: string, modifiers: TravelModifiers = {}): boolean {
    if (!this.currentLocationState) return false;

    const from = this.currentLocationState.currentLocationId;
    const travelInfo = this.getTravelInfo(from, to);

    if (!travelInfo) return false;

    const travelTime = this.calculateTravelTime(travelInfo.duration, modifiers);
    const energyCost = this.calculateEnergyCost(travelInfo.energyCost, modifiers);

    const now = Date.now();
    const endTime = now + travelTime * 60 * 1000; // Convert minutes to milliseconds

    this.currentLocationState.traveling = true;
    this.currentLocationState.travelRoute = {
      routeId: travelInfo.route?.id || `${from}_${to}`,
      startTime: now,
      endTime,
      progress: 0,
      paused: false,
    };

    // Queue travel start update
    if (this.gameUpdateWriter) {
      const update: GameUpdate = {
        id: `travel-start-${Date.now()}`,
        type: UPDATE_TYPES.STATE_TRANSITION,
        timestamp: now,
        priority: 1,
        payload: {
          action: 'TRAVEL_START',
          data: {
            from,
            to,
            duration: travelTime,
            energyCost,
            endTime,
          },
        },
      };
      this.gameUpdateWriter.enqueue(update);
    }

    // Set timer for travel completion
    if (travelTime > 0) {
      this.travelTimer = setTimeout(
        () => {
          this.completeTravel();
        },
        travelTime * 60 * 1000,
      );
    } else {
      // Instant travel
      this.completeTravel();
    }

    return true;
  }

  pauseTravel(): boolean {
    if (!this.currentLocationState?.traveling || !this.currentLocationState.travelRoute) {
      return false;
    }

    if (this.currentLocationState.travelRoute.paused) {
      return false; // Already paused
    }

    this.currentLocationState.travelRoute.paused = true;
    this.currentLocationState.travelRoute.pausedAt = Date.now();

    // Clear the timer
    if (this.travelTimer) {
      clearTimeout(this.travelTimer);
      this.travelTimer = null;
    }

    return true;
  }

  resumeTravel(): boolean {
    if (!this.currentLocationState?.traveling || !this.currentLocationState.travelRoute) {
      return false;
    }

    const route = this.currentLocationState.travelRoute;
    if (!route.paused || !route.pausedAt) {
      return false; // Not paused
    }

    const pauseDuration = Date.now() - route.pausedAt;
    route.endTime += pauseDuration;
    route.paused = false;
    route.pausedAt = undefined;

    // Set new timer for remaining time
    const remainingTime = route.endTime - Date.now();
    if (remainingTime > 0) {
      this.travelTimer = setTimeout(() => {
        this.completeTravel();
      }, remainingTime);
    } else {
      this.completeTravel();
    }

    return true;
  }

  cancelTravel(): boolean {
    if (!this.currentLocationState?.traveling) {
      return false;
    }

    // Clear timer
    if (this.travelTimer) {
      clearTimeout(this.travelTimer);
      this.travelTimer = null;
    }

    // Queue travel cancel update with full energy refund
    if (this.gameUpdateWriter && this.currentLocationState.travelRoute) {
      const update: GameUpdate = {
        id: `travel-cancel-${Date.now()}`,
        type: UPDATE_TYPES.STATE_TRANSITION,
        timestamp: Date.now(),
        priority: 1,
        payload: {
          action: 'TRAVEL_CANCEL',
          data: {
            refundEnergy: true, // Full energy refund per PRD
          },
        },
      };
      this.gameUpdateWriter.enqueue(update);
    }

    // Reset travel state
    this.currentLocationState.traveling = false;
    this.currentLocationState.travelRoute = undefined;

    return true;
  }

  private completeTravel(): void {
    this.completeTravelInternal();
  }

  private completeTravelInternal(): void {
    if (!this.currentLocationState?.traveling || !this.currentLocationState.travelRoute) {
      return;
    }

    const routeId = this.currentLocationState.travelRoute.routeId;
    const route = Array.from(this.routes.values()).find(
      (r) => r.id === routeId || `${r.from}_${r.to}` === routeId,
    );

    if (route) {
      // Update location
      const destination = route.to;
      this.currentLocationState.currentLocationId = destination;

      // Set default area if city
      const destLocation = this.locations.get(destination);
      if (destLocation?.type === LOCATION_TYPES.CITY) {
        this.currentLocationState.currentArea = CITY_AREAS.SQUARE;
      } else {
        this.currentLocationState.currentArea = undefined;
      }

      // Update visit tracking
      if (!this.currentLocationState.visitedLocations.includes(destination)) {
        this.currentLocationState.visitedLocations.push(destination);
      }
      this.currentLocationState.lastVisitTimes[destination] = Date.now();

      // Queue travel complete update
      if (this.gameUpdateWriter) {
        const update: GameUpdate = {
          id: `travel-complete-${Date.now()}`,
          type: UPDATE_TYPES.STATE_TRANSITION,
          timestamp: Date.now(),
          priority: 1,
          payload: {
            action: 'TRAVEL_COMPLETE',
            data: {
              destination,
              area: this.currentLocationState.currentArea,
            },
          },
        };
        this.gameUpdateWriter.enqueue(update);
      }
    }

    // Clear travel state
    this.currentLocationState.traveling = false;
    this.currentLocationState.travelRoute = undefined;
    this.travelTimer = null;
  }

  moveToArea(area: CityArea): boolean {
    if (!this.currentLocationState) return false;

    const currentLocation = this.getCurrentLocation();
    if (!currentLocation || currentLocation.type !== LOCATION_TYPES.CITY) {
      return false; // Not in a city
    }

    const cityLocation = currentLocation as CityLocation;
    const areaInfo = cityLocation.areas[area as keyof typeof cityLocation.areas];
    if (!areaInfo?.available) {
      return false; // Area not available
    }

    // Intra-city movement is instant and free
    this.currentLocationState.currentArea = area;

    // Queue area change update
    if (this.gameUpdateWriter) {
      const update: GameUpdate = {
        id: `area-change-${Date.now()}`,
        type: UPDATE_TYPES.STATE_TRANSITION,
        timestamp: Date.now(),
        priority: 1,
        payload: {
          action: 'AREA_CHANGE',
          data: {
            locationId: this.currentLocationState.currentLocationId,
            area,
          },
        },
      };
      this.gameUpdateWriter.enqueue(update);
    }

    return true;
  }

  getLocationState(): LocationState | null {
    return this.currentLocationState;
  }

  setLocationState(state: LocationState): void {
    this.currentLocationState = state;
  }

  getVisitedLocations(): string[] {
    return this.currentLocationState?.visitedLocations || [];
  }

  hasVisited(locationId: string): boolean {
    return this.currentLocationState?.visitedLocations.includes(locationId) || false;
  }

  getLastVisitTime(locationId: string): number | null {
    return this.currentLocationState?.lastVisitTimes[locationId] || null;
  }

  // Get available destinations from current location
  getAvailableDestinations(): string[] {
    const currentLocation = this.currentLocationState?.currentLocationId;
    if (!currentLocation) return [];

    const destinations: string[] = [];
    this.routes.forEach((route, _key) => {
      if (route.from === currentLocation) {
        destinations.push(route.to);
      }
    });

    return destinations;
  }

  // Check if a route exists between two locations
  hasRoute(from: string, to: string): boolean {
    const key = `${from}_${to}`;
    return this.routes.has(key);
  }
}
