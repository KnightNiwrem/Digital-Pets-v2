/**
 * InventorySystem Test Suite
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { InventorySystem } from './InventorySystem';
import type { GameState, InventoryItem } from '../models';
import { ITEM_CATEGORIES, GROWTH_STAGES, RARITY_TIERS, STATUS_TYPES } from '../models/constants';
import type { GameUpdateWriter } from '../engine/GameUpdatesQueue';
import type { Item } from '../models/Item';

// Mock game update writer
const mockGameUpdateWriter: GameUpdateWriter = {
  enqueue: () => {},
};

// Mock item definitions
const mockItems: Record<string, Item> = {
  apple: {
    id: 'apple',
    name: 'Apple',
    description: 'A fresh apple',
    category: ITEM_CATEGORIES.FOOD,
    sprite: 'apple.png',
    stackable: true,
    maxStack: 99,
    sellPrice: 5,
    buyPrice: 10,
    rarity: RARITY_TIERS.COMMON,
    consumable: true,
  },
  water: {
    id: 'water',
    name: 'Water',
    description: 'Fresh water',
    category: ITEM_CATEGORIES.DRINK,
    sprite: 'water.png',
    stackable: true,
    maxStack: 99,
    sellPrice: 3,
    buyPrice: 5,
    rarity: RARITY_TIERS.COMMON,
    consumable: true,
  },
  pickaxe: {
    id: 'pickaxe',
    name: 'Pickaxe',
    description: 'A mining tool',
    category: ITEM_CATEGORIES.TOOL,
    sprite: 'pickaxe.png',
    stackable: false,
    maxStack: 1,
    sellPrice: 50,
    buyPrice: 100,
    rarity: RARITY_TIERS.COMMON,
    consumable: false,
  },
  ball: {
    id: 'ball',
    name: 'Ball',
    description: 'A bouncy ball',
    category: ITEM_CATEGORIES.TOY,
    sprite: 'ball.png',
    stackable: true,
    maxStack: 10,
    sellPrice: 10,
    buyPrice: 20,
    rarity: RARITY_TIERS.COMMON,
    consumable: false,
  },
};

// Create default game state
function createGameState(): GameState {
  return {
    version: '1.0.0',
    timestamp: Date.now(),
    playerId: 'test-player',
    pet: {
      id: 'test-pet',
      name: 'Fluffy',
      species: 'cat',
      rarity: RARITY_TIERS.COMMON,
      stage: GROWTH_STAGES.ADULT,
      stageStartTime: Date.now(),
      stats: {
        health: 100,
        maxHealth: 100,
        attack: 10,
        defense: 10,
        speed: 10,
        action: 20,
        maxAction: 20,
      },
      energy: 100,
      maxEnergy: 120,
      careValues: {
        satiety: 100,
        hydration: 100,
        happiness: 100,
      },
      hiddenCounters: {
        satietyTicks: 100,
        hydrationTicks: 100,
        happinessTicks: 100,
        lifeTicks: 100,
      },
      status: {
        primary: STATUS_TYPES.HEALTHY,
      },
      moves: [],
      poopCount: 0,
      lastInteractionTime: Date.now(),
      birthTime: Date.now(),
      experiencePoints: 0,
      trainingCounts: {
        health: 0,
        attack: 0,
        defense: 0,
        speed: 0,
        action: 0,
      },
    },
    inventory: {
      items: [],
      currency: {
        coins: 100,
      },
      maxSlots: 20,
      unlockedSlots: 20,
    },
    world: {
      currentLocation: {
        currentLocationId: 'city-square',
        traveling: false,
        inActivity: false,
        visitedLocations: ['city-square'],
        lastVisitTimes: {
          'city-square': Date.now(),
        },
      },
      activeTimers: [],
      eventParticipation: [],
      currentEvents: [],
      worldTime: Date.now(),
      lastTickTime: Date.now(),
      tickCount: 0,
    },
    collections: {
      eggs: [],
      species: {},
      memorials: [],
    },
    meta: {
      settings: {
        masterVolume: 100,
        musicVolume: 100,
        sfxVolume: 100,
        textSize: 'medium',
        colorBlindMode: 'off',
        highContrast: false,
        reducedMotion: false,
        showParticles: true,
        autoSave: true,
        autoSaveInterval: 5,
        confirmActions: true,
        showTutorialHints: true,
        enableNotifications: true,
        lowCareWarning: true,
        activityComplete: true,
        eventReminders: true,
        touchControls: true,
        keyboardShortcuts: true,
        swipeGestures: true,
      },
      tutorialProgress: {
        completed: [],
        skipped: false,
        milestones: {
          firstFeed: false,
          firstDrink: false,
          firstPlay: false,
          firstClean: false,
          firstSleep: false,
          firstActivity: false,
          firstBattle: false,
          firstShop: false,
          firstTravel: false,
          firstTraining: false,
        },
      },
      statistics: {
        firstPlayTime: Date.now(),
        totalPlayTime: 0,
        lastPlayTime: Date.now(),
        consecutiveDays: 0,
        totalPetsOwned: 1,
        totalPetsLost: 0,
        currentPetAge: 0,
        longestPetLife: 0,
        totalFeedings: 0,
        totalDrinks: 0,
        totalPlays: 0,
        totalCleanings: 0,
        activitiesCompleted: {},
        totalItemsCollected: 0,
        totalCurrencyEarned: 100,
        totalCurrencySpent: 0,
        battleStats: {
          totalBattles: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          flees: 0,
          totalDamageDealt: 0,
          totalDamageTaken: 0,
          totalHealing: 0,
          criticalHits: 0,
          movesUsed: {},
          longestBattle: 0,
          shortestVictory: 0,
          highestDamage: 0,
          mostConsecutiveWins: 0,
          byType: {},
        },
        speciesDiscovered: 1,
        totalSpecies: 100,
        itemsDiscovered: 0,
        totalItems: 100,
        locationsVisited: 1,
        totalTravelDistance: 0,
      },
    },
    saveData: {
      lastSaveTime: Date.now(),
      autoSaveEnabled: true,
      saveCount: 0,
      backupSlots: {},
    },
  };
}

describe('InventorySystem', () => {
  let system: InventorySystem;
  let gameState: GameState;

  beforeEach(async () => {
    system = new InventorySystem();
    gameState = createGameState();

    // Initialize system
    await system.initialize({
      gameUpdateWriter: mockGameUpdateWriter,
    });

    // Mock item definitions
    (system as any).itemDefinitions = new Map(Object.entries(mockItems));
  });

  describe('Item Management', () => {
    it('should add stackable items to inventory', () => {
      const result = system.addItem(gameState, 'apple', 5);

      expect(result.success).toBe(true);
      expect(gameState.inventory.items).toHaveLength(1);
      expect(gameState.inventory.items[0]?.itemId).toBe('apple');
      expect(gameState.inventory.items[0]?.quantity).toBe(5);
    });

    it('should stack items when adding to existing stack', () => {
      system.addItem(gameState, 'apple', 5);
      const result = system.addItem(gameState, 'apple', 3);

      expect(result.success).toBe(true);
      expect(gameState.inventory.items).toHaveLength(1);
      expect(gameState.inventory.items[0]?.quantity).toBe(8);
    });

    it('should create new stack when existing is full', () => {
      // Add 99 apples (max stack)
      system.addItem(gameState, 'apple', 99);

      // Add 5 more
      const result = system.addItem(gameState, 'apple', 5);

      expect(result.success).toBe(true);
      expect(gameState.inventory.items).toHaveLength(2);
      expect(gameState.inventory.items[0]?.quantity).toBe(99);
      expect(gameState.inventory.items[1]?.quantity).toBe(5);
    });

    it('should handle non-stackable items', () => {
      const result = system.addItem(gameState, 'pickaxe', 3);

      expect(result.success).toBe(true);
      expect(gameState.inventory.items).toHaveLength(3);
      gameState.inventory.items.forEach((item) => {
        expect(item.itemId).toBe('pickaxe');
        expect(item.quantity).toBe(1);
      });
    });

    it('should handle inventory overflow', () => {
      // Fill inventory
      gameState.inventory.maxSlots = 2;

      const result = system.addItem(gameState, 'apple', 250); // More than 2 stacks

      expect(result.success).toBe(true);
      expect(result.overflow).toBeDefined();
      expect(gameState.inventory.items).toHaveLength(2);
      expect(result.overflow![0]?.quantity).toBe(52); // 250 - 99 - 99 = 52
    });

    it('should remove items from inventory', () => {
      system.addItem(gameState, 'apple', 10);

      const result = system.removeItem(gameState, 'apple', 5);

      expect(result.success).toBe(true);
      expect(gameState.inventory.items[0]?.quantity).toBe(5);
    });

    it('should remove entire stack when quantity matches', () => {
      system.addItem(gameState, 'apple', 10);

      const result = system.removeItem(gameState, 'apple', 10);

      expect(result.success).toBe(true);
      expect(gameState.inventory.items).toHaveLength(0);
    });

    it('should fail to remove more items than available', () => {
      system.addItem(gameState, 'apple', 5);

      const result = system.removeItem(gameState, 'apple', 10);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Not enough items');
    });

    it('should remove items from multiple stacks', () => {
      system.addItem(gameState, 'apple', 99);
      system.addItem(gameState, 'apple', 50);

      const result = system.removeItem(gameState, 'apple', 120);

      expect(result.success).toBe(true);
      expect(gameState.inventory.items).toHaveLength(1);
      expect(gameState.inventory.items[0]?.quantity).toBe(29); // 149 - 120 = 29
    });
  });

  describe('Item Usage', () => {
    it('should fail to use non-existent item', () => {
      const result = system.useItem(gameState, 'nonexistent', 1);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Item not found');
    });

    it('should fail to use item not in inventory', () => {
      const result = system.useItem(gameState, 'apple', 1);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Not enough items in inventory');
    });

    it('should fail to use non-consumable item', () => {
      system.addItem(gameState, 'pickaxe', 1);

      const result = system.useItem(gameState, 'pickaxe', 1);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Item is not consumable');
    });
  });

  describe('Currency Management', () => {
    it('should add currency', () => {
      const result = system.addCurrency(gameState, 50);

      expect(result.success).toBe(true);
      expect(result.previousAmount).toBe(100);
      expect(result.newAmount).toBe(150);
      expect(result.change).toBe(50);
      expect(gameState.inventory.currency.coins).toBe(150);
    });

    it('should cap currency at max limit', () => {
      gameState.inventory.currency.coins = 999990;

      const result = system.addCurrency(gameState, 20);

      expect(result.success).toBe(true);
      expect(result.newAmount).toBe(999999);
      expect(result.change).toBe(9);
      expect(result.message).toContain('max reached');
    });

    it('should remove currency', () => {
      const result = system.removeCurrency(gameState, 30);

      expect(result.success).toBe(true);
      expect(result.previousAmount).toBe(100);
      expect(result.newAmount).toBe(70);
      expect(result.change).toBe(-30);
      expect(gameState.inventory.currency.coins).toBe(70);
    });

    it('should fail to remove more currency than available', () => {
      const result = system.removeCurrency(gameState, 150);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Not enough coins');
      expect(gameState.inventory.currency.coins).toBe(100); // Unchanged
    });

    it('should check currency availability', () => {
      expect(system.hasCurrency(gameState, 50)).toBe(true);
      expect(system.hasCurrency(gameState, 100)).toBe(true);
      expect(system.hasCurrency(gameState, 101)).toBe(false);
    });
  });

  describe('Inventory Queries', () => {
    beforeEach(() => {
      system.addItem(gameState, 'apple', 10);
      system.addItem(gameState, 'water', 5);
      system.addItem(gameState, 'pickaxe', 1);
      system.addItem(gameState, 'ball', 3);
    });

    it('should check if item exists in inventory', () => {
      expect(system.hasItem(gameState, 'apple', 5)).toBe(true);
      expect(system.hasItem(gameState, 'apple', 15)).toBe(false);
      expect(system.hasItem(gameState, 'nonexistent', 1)).toBe(false);
    });

    it('should get total quantity of an item', () => {
      system.addItem(gameState, 'apple', 99); // Create second stack

      expect(system.getItemQuantity(gameState, 'apple')).toBe(109);
      expect(system.getItemQuantity(gameState, 'water')).toBe(5);
      expect(system.getItemQuantity(gameState, 'nonexistent')).toBe(0);
    });

    it('should check if inventory is full', () => {
      expect(system.isInventoryFull(gameState)).toBe(false);

      gameState.inventory.maxSlots = 4; // We have 4 items
      expect(system.isInventoryFull(gameState)).toBe(true);
    });

    it('should get available space', () => {
      expect(system.getAvailableSpace(gameState)).toBe(16); // 20 - 4

      gameState.inventory.maxSlots = 4;
      expect(system.getAvailableSpace(gameState)).toBe(0);
    });

    it('should get inventory statistics', () => {
      const stats = system.getInventoryStats(gameState);

      expect(stats.totalItems).toBe(19); // 10 + 5 + 1 + 3
      expect(stats.totalStacks).toBe(4);
      expect(stats.usedSlots).toBe(4);
      expect(stats.maxSlots).toBe(20);
      expect(stats.totalValue).toBe(145); // (10*5) + (5*3) + (1*50) + (3*10) = 50 + 15 + 50 + 30
      expect(stats.categoryCounts[ITEM_CATEGORIES.FOOD]).toBe(10);
      expect(stats.categoryCounts[ITEM_CATEGORIES.DRINK]).toBe(5);
      expect(stats.categoryCounts[ITEM_CATEGORIES.TOOL]).toBe(1);
      expect(stats.categoryCounts[ITEM_CATEGORIES.TOY]).toBe(3);
    });
  });

  describe('Inventory Sorting', () => {
    beforeEach(() => {
      system.addItem(gameState, 'water', 5);
      system.addItem(gameState, 'apple', 10);
      system.addItem(gameState, 'pickaxe', 1);
      system.addItem(gameState, 'ball', 3);
    });

    it('should sort by name', () => {
      system.sortInventory(gameState, 'name');

      const items = gameState.inventory.items;
      expect(items[0]?.itemId).toBe('apple');
      expect(items[1]?.itemId).toBe('ball');
      expect(items[2]?.itemId).toBe('pickaxe');
      expect(items[3]?.itemId).toBe('water');
    });

    it('should sort by category', () => {
      system.sortInventory(gameState, 'category');

      const items = gameState.inventory.items;
      const categories = items.map((item) => mockItems[item.itemId]?.category);

      // Categories should be sorted alphabetically
      expect(categories[0]).toBe(ITEM_CATEGORIES.DRINK);
      expect(categories[1]).toBe(ITEM_CATEGORIES.FOOD);
      expect(categories[2]).toBe(ITEM_CATEGORIES.TOOL);
      expect(categories[3]).toBe(ITEM_CATEGORIES.TOY);
    });

    it('should sort by quantity', () => {
      system.sortInventory(gameState, 'quantity');

      const items = gameState.inventory.items;
      expect(items[0]?.quantity).toBe(10); // apple
      expect(items[1]?.quantity).toBe(5); // water
      expect(items[2]?.quantity).toBe(3); // ball
      expect(items[3]?.quantity).toBe(1); // pickaxe
    });

    it('should sort by value', () => {
      system.sortInventory(gameState, 'value');

      const items = gameState.inventory.items;
      expect(items[0]?.itemId).toBe('apple'); // 10 * 5 = 50
      expect(items[1]?.itemId).toBe('pickaxe'); // 1 * 50 = 50
      expect(items[2]?.itemId).toBe('ball'); // 3 * 10 = 30
      expect(items[3]?.itemId).toBe('water'); // 5 * 3 = 15
    });
  });

  describe('Inventory Filtering', () => {
    beforeEach(() => {
      system.addItem(gameState, 'apple', 10);
      system.addItem(gameState, 'water', 5);
      system.addItem(gameState, 'pickaxe', 1);
      system.addItem(gameState, 'ball', 3);
    });

    it('should filter by category', () => {
      const filtered = system.filterInventory(gameState, {
        category: ITEM_CATEGORIES.FOOD,
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.itemId).toBe('apple');
    });

    it('should filter by stackable', () => {
      const stackable = system.filterInventory(gameState, {
        stackable: true,
      });

      expect(stackable).toHaveLength(3); // apple, water, ball are stackable

      const nonStackable = system.filterInventory(gameState, {
        stackable: false,
      });

      expect(nonStackable).toHaveLength(1);
      expect(nonStackable[0]?.itemId).toBe('pickaxe');
    });

    it('should filter by consumable', () => {
      const consumable = system.filterInventory(gameState, {
        consumable: true,
      });

      expect(consumable).toHaveLength(2); // apple and water

      const nonConsumable = system.filterInventory(gameState, {
        consumable: false,
      });

      expect(nonConsumable).toHaveLength(2); // pickaxe and ball
    });

    it('should filter by minimum quantity', () => {
      const filtered = system.filterInventory(gameState, {
        minQuantity: 5,
      });

      expect(filtered).toHaveLength(2); // apple (10) and water (5)
    });

    it('should filter by search term', () => {
      const filtered = system.filterInventory(gameState, {
        searchTerm: 'app',
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.itemId).toBe('apple');
    });

    it('should combine multiple filters', () => {
      const filtered = system.filterInventory(gameState, {
        consumable: true,
        minQuantity: 6,
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.itemId).toBe('apple');
    });
  });

  describe('Inventory Operations', () => {
    it('should expand inventory slots', () => {
      expect(gameState.inventory.maxSlots).toBe(20);

      const success = system.expandInventory(gameState, 10);

      expect(success).toBe(true);
      expect(gameState.inventory.maxSlots).toBe(30);
      expect(gameState.inventory.unlockedSlots).toBe(30);
    });

    it('should not expand beyond max limit', () => {
      gameState.inventory.maxSlots = 195;

      const success = system.expandInventory(gameState, 10);

      expect(success).toBe(false);
      expect(gameState.inventory.maxSlots).toBe(195);
    });

    it('should clear expired items', () => {
      system.addItem(gameState, 'apple', 10);
      system.addItem(gameState, 'water', 5);
      system.addItem(gameState, 'ball', 3);

      const removedCount = system.clearExpiredItems(gameState, ['apple', 'ball']);

      expect(removedCount).toBe(13); // 10 apples + 3 balls
      expect(gameState.inventory.items).toHaveLength(1);
      expect(gameState.inventory.items[0]?.itemId).toBe('water');
    });
  });

  describe('Durability Management', () => {
    it('should reduce item durability', () => {
      // Add tool with durability
      const toolItem: InventoryItem = {
        itemId: 'pickaxe',
        quantity: 1,
        obtainedTime: Date.now(),
        currentDurability: 100,
      };
      gameState.inventory.items.push(toolItem);

      const success = system.reduceDurability(gameState, 'pickaxe', 10);

      expect(success).toBe(true);
      expect(toolItem.currentDurability).toBe(90);
    });

    it('should remove item when durability reaches 0', () => {
      const toolItem: InventoryItem = {
        itemId: 'pickaxe',
        quantity: 1,
        obtainedTime: Date.now(),
        currentDurability: 5,
      };
      gameState.inventory.items.push(toolItem);

      const success = system.reduceDurability(gameState, 'pickaxe', 5);

      expect(success).toBe(true);
      expect(gameState.inventory.items).toHaveLength(0);
    });

    it('should not affect items without durability', () => {
      system.addItem(gameState, 'apple', 5);

      const success = system.reduceDurability(gameState, 'apple', 1);

      expect(success).toBe(false);
      expect(gameState.inventory.items[0]?.quantity).toBe(5);
    });
  });

  describe('Item Transfer', () => {
    it('should transfer stackable items between inventories', () => {
      const fromInventory: InventoryItem[] = [
        {
          itemId: 'apple',
          quantity: 10,
          obtainedTime: Date.now(),
        },
      ];

      const toInventory: InventoryItem[] = [];

      const result = system.transferItems(fromInventory, toInventory, 'apple', 5, 20);

      expect(result.success).toBe(true);
      expect(fromInventory[0]?.quantity).toBe(5);
      expect(toInventory[0]?.quantity).toBe(5);
    });

    it('should transfer non-stackable items', () => {
      const fromInventory: InventoryItem[] = [
        { itemId: 'pickaxe', quantity: 1, obtainedTime: Date.now() },
        { itemId: 'pickaxe', quantity: 1, obtainedTime: Date.now() },
      ];

      const toInventory: InventoryItem[] = [];

      const result = system.transferItems(fromInventory, toInventory, 'pickaxe', 1, 20);

      expect(result.success).toBe(true);
      expect(fromInventory).toHaveLength(1);
      expect(toInventory).toHaveLength(1);
    });

    it('should fail transfer if source has insufficient items', () => {
      const fromInventory: InventoryItem[] = [
        {
          itemId: 'apple',
          quantity: 5,
          obtainedTime: Date.now(),
        },
      ];

      const toInventory: InventoryItem[] = [];

      const result = system.transferItems(fromInventory, toInventory, 'apple', 10, 20);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Not enough items');
    });

    it('should fail transfer if destination is full', () => {
      const fromInventory: InventoryItem[] = [
        {
          itemId: 'pickaxe',
          quantity: 1,
          obtainedTime: Date.now(),
        },
      ];

      const toInventory: InventoryItem[] = [
        { itemId: 'apple', quantity: 1, obtainedTime: Date.now() },
      ];

      const result = system.transferItems(
        fromInventory,
        toInventory,
        'pickaxe',
        1,
        1, // Max slots = 1, already occupied
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('full');
    });
  });
});
