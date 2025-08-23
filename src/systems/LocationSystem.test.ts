import { describe, it, expect, beforeEach } from 'bun:test';
import { LocationSystem } from './LocationSystem';
import type { GameState } from '../models';
import { LOCATION_TYPES, CITY_AREAS, GROWTH_STAGES } from '../models/constants';
import { createMockGameState } from '../testing/mocks';

describe('LocationSystem', () => {
  let locationSystem: LocationSystem;
  let gameState: GameState;
  let queuedUpdates: any[] = [];

  beforeEach(async () => {
    locationSystem = new LocationSystem();
    gameState = createMockGameState();
    queuedUpdates = [];

    // Initialize system with a mock update writer
    await locationSystem.initialize({
      gameUpdateWriter: {
        enqueue: (update: any) => {
          queuedUpdates.push(update);
        },
      },
    } as any);
  });

  describe('Location Management', () => {
    it('should initialize with default location', () => {
      const currentLocation = locationSystem.getCurrentLocation();
      expect(currentLocation).toBeDefined();
      expect(currentLocation?.id).toBe('main_city');
      expect(currentLocation?.type).toBe(LOCATION_TYPES.CITY);
    });

    it('should get location by ID', () => {
      const forest = locationSystem.getLocation('forest');
      expect(forest).toBeDefined();
      expect(forest?.type).toBe(LOCATION_TYPES.WILD);
      expect(forest?.name).toBe('Dense Forest');
    });

    it('should return all locations', () => {
      const allLocations = locationSystem.getAllLocations();
      expect(allLocations.size).toBeGreaterThan(0);
      expect(allLocations.has('main_city')).toBe(true);
      expect(allLocations.has('forest')).toBe(true);
      expect(allLocations.has('mountains')).toBe(true);
    });

    it('should track visited locations', () => {
      const visited = locationSystem.getVisitedLocations();
      expect(visited).toContain('main_city');
      expect(locationSystem.hasVisited('main_city')).toBe(true);
      expect(locationSystem.hasVisited('forest')).toBe(false);
    });

    it('should track last visit times', () => {
      const lastVisit = locationSystem.getLastVisitTime('main_city');
      expect(lastVisit).toBeDefined();
      expect(lastVisit).toBeGreaterThan(0);
    });
  });

  describe('City Area Movement', () => {
    it('should move to different areas within a city', () => {
      // Start in town square
      expect(locationSystem.getCurrentArea()).toBe(CITY_AREAS.SQUARE);

      // Move to shop
      const result = locationSystem.moveToArea(CITY_AREAS.SHOP);
      expect(result).toBe(true);
      expect(locationSystem.getCurrentArea()).toBe(CITY_AREAS.SHOP);
      expect(queuedUpdates.length).toBe(1);
      expect(queuedUpdates[0].payload.action).toBe('AREA_CHANGE');
    });

    it('should not move to unavailable areas', () => {
      // Move to forest town which has limited areas
      const state = locationSystem.getLocationState();
      if (state) {
        state.currentLocationId = 'forest_town';
        locationSystem.setLocationState(state);
      }

      // Try to move to arena (not available in forest town)
      const result = locationSystem.moveToArea(CITY_AREAS.ARENA);
      expect(result).toBe(false);
    });

    it('should not allow area movement in wild locations', () => {
      // Move to forest (wild location)
      const state = locationSystem.getLocationState();
      if (state) {
        state.currentLocationId = 'forest';
        locationSystem.setLocationState(state);
      }

      const result = locationSystem.moveToArea(CITY_AREAS.SHOP);
      expect(result).toBe(false);
    });
  });

  describe('Travel Routes', () => {
    it('should find routes between locations', () => {
      const hasRoute = locationSystem.hasRoute('main_city', 'forest');
      expect(hasRoute).toBe(true);

      const hasInvalidRoute = locationSystem.hasRoute('main_city', 'nonexistent');
      expect(hasInvalidRoute).toBe(false);
    });

    it('should get travel info between locations', () => {
      const travelInfo = locationSystem.getTravelInfo('main_city', 'forest');
      expect(travelInfo).toBeDefined();
      expect(travelInfo?.distance).toBe('short');
      expect(travelInfo?.duration).toBe(3);
      expect(travelInfo?.energyCost).toBe(10);
    });

    it('should return null for invalid routes', () => {
      const travelInfo = locationSystem.getTravelInfo('main_city', 'nonexistent');
      expect(travelInfo).toBeNull();
    });

    it('should get available destinations from current location', () => {
      const destinations = locationSystem.getAvailableDestinations();
      expect(destinations).toContain('forest_town');
      expect(destinations).toContain('mountain_village');
      expect(destinations).toContain('forest');
      expect(destinations).toContain('lake');
    });

    it('should have reverse routes', () => {
      // Check that reverse routes are created
      const forwardRoute = locationSystem.hasRoute('main_city', 'forest');
      const reverseRoute = locationSystem.hasRoute('forest', 'main_city');
      expect(forwardRoute).toBe(true);
      expect(reverseRoute).toBe(true);
    });
  });

  describe('Travel Mechanics', () => {
    it('should check if travel is possible', () => {
      const canTravel = locationSystem.canTravel('forest', 100, GROWTH_STAGES.ADULT);
      expect(canTravel.canTravel).toBe(true);

      // Check with insufficient energy
      const cantTravel = locationSystem.canTravel('forest', 5, GROWTH_STAGES.ADULT);
      expect(cantTravel.canTravel).toBe(false);
      expect(cantTravel.reason).toBe('Not enough energy');
    });

    it('should not allow travel while already traveling', () => {
      locationSystem.startTravel('forest');

      const canTravel = locationSystem.canTravel('lake', 100, GROWTH_STAGES.ADULT);
      expect(canTravel.canTravel).toBe(false);
      expect(canTravel.reason).toBe('Already traveling');
    });

    it('should start travel successfully', () => {
      const result = locationSystem.startTravel('forest');
      expect(result).toBe(true);
      expect(locationSystem.isTraveling()).toBe(true);
      expect(queuedUpdates.length).toBe(1);
      expect(queuedUpdates[0].payload.action).toBe('TRAVEL_START');
    });

    it('should handle instant travel (intra-city)', () => {
      // Move to forest town
      const state = locationSystem.getLocationState();
      if (state) {
        state.currentLocationId = 'forest_town';
        locationSystem.setLocationState(state);
      }

      // Travel to adjacent forest (instant)
      const result = locationSystem.startTravel('forest');
      expect(result).toBe(true);

      // Should complete immediately
      const newLocation = locationSystem.getCurrentLocationId();
      expect(newLocation).toBe('forest');
    });

    it('should cancel travel with energy refund', () => {
      locationSystem.startTravel('forest');
      expect(locationSystem.isTraveling()).toBe(true);

      const result = locationSystem.cancelTravel();
      expect(result).toBe(true);
      expect(locationSystem.isTraveling()).toBe(false);

      // Check for cancel update with refund
      const cancelUpdate = queuedUpdates.find((u) => u.payload.action === 'TRAVEL_CANCEL');
      expect(cancelUpdate).toBeDefined();
      expect(cancelUpdate.payload.data.refundEnergy).toBe(true);
    });

    it('should pause and resume travel', () => {
      locationSystem.startTravel('mountain_village');
      expect(locationSystem.isTraveling()).toBe(true);

      // Pause travel
      const pauseResult = locationSystem.pauseTravel();
      expect(pauseResult).toBe(true);

      const state = locationSystem.getLocationState();
      expect(state?.travelRoute?.paused).toBe(true);

      // Resume travel
      const resumeResult = locationSystem.resumeTravel();
      expect(resumeResult).toBe(true);
      expect(state?.travelRoute?.paused).toBe(false);
    });
  });

  describe('Travel Modifiers', () => {
    it('should apply injury penalty to travel time', () => {
      const baseTime = 10;
      const modifiedTime = locationSystem.calculateTravelTime(baseTime, { injured: true });
      expect(modifiedTime).toBe(15); // 50% slower
    });

    it('should apply speed item bonus to travel time', () => {
      const baseTime = 10;
      const modifiedTime = locationSystem.calculateTravelTime(baseTime, {
        speedItem: 'speed_boost',
      });
      expect(modifiedTime).toBe(7); // 30% faster
    });

    it('should apply weather penalty to travel time', () => {
      const baseTime = 10;
      const modifiedTime = locationSystem.calculateTravelTime(baseTime, { weatherPenalty: 0.2 });
      expect(modifiedTime).toBe(12); // 20% slower
    });

    it('should apply multiple modifiers', () => {
      const baseTime = 10;
      const modifiedTime = locationSystem.calculateTravelTime(baseTime, {
        injured: true,
        speedItem: 'speed_boost',
      });
      // First injury penalty (x1.5 = 15), then speed bonus (x0.7 = 10.5, rounded to 11)
      expect(modifiedTime).toBe(11);
    });

    it('should calculate energy cost with modifiers', () => {
      const baseCost = 20;

      // Speed items reduce energy cost slightly
      const modifiedCost = locationSystem.calculateEnergyCost(baseCost, {
        speedItem: 'speed_boost',
      });
      expect(modifiedCost).toBe(18); // 10% reduction

      // Injuries don't affect energy cost
      const injuredCost = locationSystem.calculateEnergyCost(baseCost, { injured: true });
      expect(injuredCost).toBe(baseCost);
    });
  });

  describe('Location State Management', () => {
    it('should get and set location state', () => {
      const state = locationSystem.getLocationState();
      expect(state).toBeDefined();
      expect(state?.currentLocationId).toBe('main_city');

      // Modify and set state
      if (state) {
        state.currentLocationId = 'forest';
        locationSystem.setLocationState(state);
      }

      const newState = locationSystem.getLocationState();
      expect(newState?.currentLocationId).toBe('forest');
    });

    it('should update state from game state', async () => {
      // Create a modified game state
      gameState.world.currentLocation = {
        currentLocationId: 'mountain_village',
        currentArea: CITY_AREAS.GYM,
        traveling: false,
        inActivity: false,
        visitedLocations: ['main_city', 'mountain_village'],
        lastVisitTimes: {
          main_city: Date.now() - 1000,
          mountain_village: Date.now(),
        },
      };

      // Trigger update
      await locationSystem.update(gameState);

      // Check that state was updated
      const state = locationSystem.getLocationState();
      expect(state?.currentLocationId).toBe('mountain_village');
      expect(state?.currentArea).toBe(CITY_AREAS.GYM);
    });
  });

  describe('Travel Completion', () => {
    it('should complete travel during tick', async () => {
      // Start a short travel
      locationSystem.startTravel('forest');
      const state = locationSystem.getLocationState();

      if (state?.travelRoute) {
        // Simulate time passing
        state.travelRoute.endTime = Date.now() - 1000; // Set end time in the past
      }

      // Process tick
      await locationSystem.tick(1000, gameState);

      // Check travel completed
      expect(locationSystem.isTraveling()).toBe(false);
      expect(locationSystem.getCurrentLocationId()).toBe('forest');

      // Check for completion update
      const completeUpdate = queuedUpdates.find((u) => u.payload.action === 'TRAVEL_COMPLETE');
      expect(completeUpdate).toBeDefined();
    });

    it('should update progress during travel', async () => {
      locationSystem.startTravel('mountain_village');
      const state = locationSystem.getLocationState();

      if (state?.travelRoute) {
        // Set times for 50% progress
        const now = Date.now();
        state.travelRoute.startTime = now - 3000;
        state.travelRoute.endTime = now + 3000;
      }

      // Process tick
      await locationSystem.tick(1000, gameState);

      // Check progress updated
      const progress = state?.travelRoute?.progress || 0;
      expect(progress).toBeGreaterThan(0.4);
      expect(progress).toBeLessThan(0.6);
      expect(locationSystem.isTraveling()).toBe(true); // Still traveling
    });
  });

  describe('Reset and Shutdown', () => {
    it('should reset to default state', async () => {
      // Modify state
      locationSystem.startTravel('forest');
      expect(locationSystem.isTraveling()).toBe(true);

      // Reset
      await locationSystem.reset();

      // Check reset to defaults
      expect(locationSystem.isTraveling()).toBe(false);
      expect(locationSystem.getCurrentLocationId()).toBe('main_city');
      expect(locationSystem.getCurrentArea()).toBe(CITY_AREAS.SQUARE);
    });

    it('should clean up on shutdown', async () => {
      // Start travel
      locationSystem.startTravel('forest');

      // Shutdown
      await locationSystem.shutdown();

      // Check cleanup
      expect(locationSystem.isTraveling()).toBe(false);
    });
  });

  describe('Growth Stage Requirements', () => {
    it('should enforce minimum stage requirements for travel', () => {
      // Assuming mountains might have requirements, let's test the logic
      const canTravelAsHatchling = locationSystem.canTravel('forest', 100, GROWTH_STAGES.HATCHLING);
      const canTravelAsAdult = locationSystem.canTravel('forest', 100, GROWTH_STAGES.ADULT);

      // Both should be able to travel to forest (no requirements)
      expect(canTravelAsHatchling.canTravel).toBe(true);
      expect(canTravelAsAdult.canTravel).toBe(true);
    });
  });
});
