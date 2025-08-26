import { BaseSystem, type SystemInitOptions, type SystemError } from './BaseSystem';
import type { GameUpdateWriter } from '../engine/GameUpdatesQueue';
import type { GameState, GameUpdate, OfflineCalculation } from '../models';
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
  type TravelDistance,
  type GrowthStage,
  type CityArea,
} from '../models/constants';
import { LOCATIONS_DATA } from '../data/locations';
import { ROUTES_MAP, getRoute, getConnectedLocations } from '../data/routes';

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

  constructor(gameUpdateWriter: GameUpdateWriter) {
    super('LocationSystem', gameUpdateWriter);
    // Initialize locations from data
    Object.values(LOCATIONS_DATA).forEach((location) => {
      this.locations.set(location.id, location);
    });
    // Initialize routes from data
    this.routes = new Map(ROUTES_MAP);
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
    const route = getRoute(from, to);

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

  /**
   * Process travel progress that occurred while offline
   */
  public async processOfflineTravel(
    offlineCalc: OfflineCalculation,
    gameState: GameState,
  ): Promise<void> {
    const state = gameState.world.currentLocation;
    if (!state.traveling || !state.travelRoute || state.travelRoute.paused) {
      this.currentLocationState = state;
      return;
    }

    const route = state.travelRoute;
    const now = Date.now();

    if (route.endTime <= now) {
      // Travel completed while offline
      const routeDef = Array.from(this.routes.values()).find(
        (r) => r.id === route.routeId || `${r.from}_${r.to}` === route.routeId,
      );
      const destination = routeDef?.to;

      state.traveling = false;
      if (destination) {
        state.currentLocationId = destination;
        state.currentArea =
          this.locations.get(destination)?.type === LOCATION_TYPES.CITY
            ? CITY_AREAS.SQUARE
            : undefined;
        if (!state.visitedLocations.includes(destination)) {
          state.visitedLocations.push(destination);
        }
        state.lastVisitTimes[destination] = now;
        offlineCalc.newLocation = destination;
      }
      state.travelRoute = undefined;
      offlineCalc.travelCompleted = true;
    } else {
      // Update progress
      const elapsed = now - route.startTime;
      const total = route.endTime - route.startTime;
      route.progress = Math.min(1, elapsed / total);
    }

    this.currentLocationState = state;
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

    return getConnectedLocations(currentLocation);
  }

  // Check if a route exists between two locations
  hasRoute(from: string, to: string): boolean {
    return getRoute(from, to) !== null;
  }
}
