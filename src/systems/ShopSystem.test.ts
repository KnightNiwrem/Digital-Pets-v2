import { describe, it, expect, beforeEach } from 'bun:test';
import { ShopSystem } from './ShopSystem';
import type { GameState } from '../models';
import { RARITY_TIERS, ITEM_CATEGORIES } from '../models/constants';
import { createMockGameState } from '../testing/mocks';

describe('ShopSystem', () => {
  let shopSystem: ShopSystem;
  let gameState: GameState;
  let queuedUpdates: any[] = [];

  beforeEach(async () => {
    shopSystem = new ShopSystem();
    gameState = createMockGameState();
    queuedUpdates = [];

    // Initialize system with a mock update writer
    await shopSystem.initialize({
      gameUpdateWriter: {
        enqueue: (update: any) => {
          queuedUpdates.push(update);
        },
      },
    } as any);

    // Give player some starting currency
    gameState.inventory.currency.coins = 1000;
  });

  describe('Daily Inventory Generation', () => {
    it('should generate daily inventory', () => {
      const inventory = shopSystem.getDailyInventory();
      expect(inventory).toBeDefined();
      expect(Array.isArray(inventory)).toBe(true);
      expect(inventory.length).toBeGreaterThan(0);
    });

    it('should use date-based seed for consistency', () => {
      const inventory1 = shopSystem.getDailyInventory(20240101);
      const inventory2 = shopSystem.getDailyInventory(20240101);

      expect(inventory1.length).toBe(inventory2.length);

      // Items should be identical for the same seed
      for (let i = 0; i < inventory1.length; i++) {
        const item1 = inventory1[i];
        const item2 = inventory2[i];
        if (item1 && item2) {
          expect(item1.item.id).toBe(item2.item.id);
          expect(item1.price).toBe(item2.price);
          expect(item1.quantity).toBe(item2.quantity);
        }
      }
    });

    it('should generate different inventory for different days', () => {
      const inventory1 = shopSystem.getDailyInventory(20240101);
      const inventory2 = shopSystem.getDailyInventory(20240102);

      // While some items might be the same, the entire inventory shouldn't be identical
      let hasDifference = false;
      for (let i = 0; i < Math.min(inventory1.length, inventory2.length); i++) {
        const item1 = inventory1[i];
        const item2 = inventory2[i];
        if (item1 && item2) {
          if (
            item1.item.id !== item2.item.id ||
            item1.price !== item2.price ||
            item1.quantity !== item2.quantity
          ) {
            hasDifference = true;
            break;
          }
        }
      }

      expect(hasDifference).toBe(true);
    });

    it('should include items from multiple categories', () => {
      const inventory = shopSystem.getDailyInventory();
      const categories = new Set<string>();

      for (const shopItem of inventory) {
        categories.add(shopItem.item.category);
      }

      // Should have at least 3 different categories
      expect(categories.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Price Calculation', () => {
    it('should calculate prices based on rarity', () => {
      const commonItem = {
        id: 'test_common',
        name: 'Common Item',
        description: 'A common item',
        category: ITEM_CATEGORIES.MATERIAL,
        sprite: 'test.png',
        stackable: true,
        maxStack: 99,
        sellPrice: 5,
        buyPrice: 10,
        rarity: RARITY_TIERS.COMMON,
        consumable: true,
      };

      const rareItem = {
        ...commonItem,
        id: 'test_rare',
        name: 'Rare Item',
        rarity: RARITY_TIERS.RARE,
      };

      const commonPrice = shopSystem.getItemPrice(commonItem);
      const rarePrice = shopSystem.getItemPrice(rareItem);

      // Rare items should be more expensive
      expect(rarePrice).toBeGreaterThan(commonPrice);
    });

    it('should apply event discounts', () => {
      const item = {
        id: 'test_item',
        name: 'Test Item',
        description: 'A test item',
        category: ITEM_CATEGORIES.MATERIAL,
        sprite: 'test.png',
        stackable: true,
        maxStack: 99,
        sellPrice: 50,
        buyPrice: 100,
        rarity: RARITY_TIERS.COMMON,
        consumable: true,
      };

      const normalPrice = shopSystem.getItemPrice(item);
      const discountedPrice = shopSystem.getItemPrice(item, 'summer_festival');

      // Event should apply discount
      expect(discountedPrice).toBeLessThan(normalPrice);

      // Verify 20% discount for summer_festival
      expect(discountedPrice).toBe(Math.round(normalPrice * 0.8));
    });

    it('should apply different discounts for different events', () => {
      const price = 100;

      const summerPrice = shopSystem.applyDiscount(price, 'summer_festival');
      const winterPrice = shopSystem.applyDiscount(price, 'winter_sale');
      const anniversaryPrice = shopSystem.applyDiscount(price, 'anniversary');

      expect(summerPrice).toBe(80); // 20% off
      expect(winterPrice).toBe(70); // 30% off
      expect(anniversaryPrice).toBe(75); // 25% off
    });
  });

  describe('Purchase Operations', () => {
    beforeEach(() => {
      // Force a specific inventory for testing
      shopSystem.forceRotation(12345);
    });

    it('should validate purchases correctly', () => {
      const inventory = shopSystem.getDailyInventory();
      const shopItem = inventory[0];

      if (shopItem) {
        const validation = shopSystem.validatePurchase(
          shopItem.item.id,
          1,
          gameState.inventory.currency.coins,
        );

        expect(validation.valid).toBe(true);
        expect(validation.price).toBeDefined();
        expect(validation.item).toBeDefined();
      }
    });

    it('should queue purchase request with sufficient funds', () => {
      const inventory = shopSystem.getDailyInventory();
      const shopItem = inventory[0];

      if (shopItem) {
        const result = shopSystem.requestPurchase(shopItem.item.id, 1, gameState);

        expect(result).toBe(true);
        expect(queuedUpdates.length).toBe(1);
        expect(queuedUpdates[0].payload.action).toBe('SHOP_PURCHASE');
      }
    });

    it('should reject purchase with insufficient funds', () => {
      gameState.inventory.currency.coins = 1; // Very little money

      const inventory = shopSystem.getDailyInventory();
      const expensiveItem = inventory.find((item) => item.price > 1);

      if (expensiveItem) {
        const result = shopSystem.requestPurchase(expensiveItem.item.id, 1, gameState);

        expect(result).toBe(false);
        expect(queuedUpdates.length).toBe(0); // No update queued
      }
    });

    it('should reject purchase when item not in shop', () => {
      const result = shopSystem.requestPurchase('non_existent_item', 1, gameState);

      expect(result).toBe(false);
      expect(queuedUpdates.length).toBe(0);
    });

    it('should reject purchase when quantity exceeds available', () => {
      const inventory = shopSystem.getDailyInventory();
      const shopItem = inventory[0];

      if (shopItem) {
        const result = shopSystem.requestPurchase(
          shopItem.item.id,
          shopItem.quantity + 100,
          gameState,
        );

        expect(result).toBe(false);
        expect(queuedUpdates.length).toBe(0);
      }
    });

    it('should update shop inventory quantity optimistically', () => {
      const inventory = shopSystem.getDailyInventory();
      const shopItem = inventory[0];

      if (shopItem) {
        const initialQuantity = shopItem.quantity;

        shopSystem.requestPurchase(shopItem.item.id, 1, gameState);

        // Check updated inventory
        const updatedInventory = shopSystem.getShopInventory();
        const updatedItem = updatedInventory?.items.find(
          (item) => item.item.id === shopItem.item.id,
        );

        expect(updatedItem?.quantity).toBe(initialQuantity - 1);
      }
    });
  });

  describe('Sell Operations', () => {
    it('should queue sell requests', () => {
      const item = {
        id: 'test_item',
        name: 'Test Item',
        description: 'A test item',
        category: ITEM_CATEGORIES.MATERIAL,
        sprite: 'test.png',
        stackable: true,
        maxStack: 99,
        sellPrice: 50,
        buyPrice: 100,
        rarity: RARITY_TIERS.COMMON,
        consumable: true,
      };

      const result = shopSystem.requestSell(item, 2);

      expect(result).toBe(true);
      expect(queuedUpdates.length).toBe(1);
      expect(queuedUpdates[0].payload.action).toBe('SHOP_SELL');
      expect(queuedUpdates[0].payload.data.quantity).toBe(2);
    });

    it('should calculate sell price at 50% of buy price', () => {
      const item = {
        id: 'test_item',
        name: 'Test Item',
        description: 'A test item',
        category: ITEM_CATEGORIES.MATERIAL,
        sprite: 'test.png',
        stackable: true,
        maxStack: 99,
        sellPrice: 50,
        buyPrice: 100,
        rarity: RARITY_TIERS.COMMON,
        consumable: true,
      };

      const buyPrice = shopSystem.getItemPrice(item);
      const sellPrice = shopSystem.calculateSellPrice(item);

      expect(sellPrice).toBe(Math.round(buyPrice * 0.5));
    });
  });

  describe('Shop Rotation', () => {
    it('should rotate inventory when forced', () => {
      const inventory1 = shopSystem.getDailyInventory(11111);
      shopSystem.forceRotation(22222);
      const inventory2 = shopSystem.getDailyInventory(22222);

      // Should be different inventories
      let hasDifference = false;
      for (let i = 0; i < Math.min(inventory1.length, inventory2.length); i++) {
        const item1 = inventory1[i];
        const item2 = inventory2[i];
        if (item1 && item2) {
          if (item1.item.id !== item2.item.id) {
            hasDifference = true;
            break;
          }
        }
      }

      expect(hasDifference).toBe(true);
    });

    it('should auto-rotate on new day during tick', async () => {
      // Set initial inventory
      shopSystem.forceRotation(20240101);

      // Simulate a tick (which checks for new day)
      await shopSystem.tick(1000, gameState);

      // Inventory seed should be based on current date
      const currentInventory = shopSystem.getShopInventory();
      expect(currentInventory).toBeDefined();
    });
  });

  describe('Item Pools', () => {
    it('should have items in all expected categories', () => {
      const inventory = shopSystem.getDailyInventory(99999);
      const foundCategories = new Set<string>();

      for (const shopItem of inventory) {
        foundCategories.add(shopItem.item.category);
      }

      // Check for key categories
      expect(foundCategories.has(ITEM_CATEGORIES.FOOD)).toBe(true);
      expect(foundCategories.has(ITEM_CATEGORIES.DRINK)).toBe(true);
      expect(foundCategories.has(ITEM_CATEGORIES.MEDICINE)).toBe(true);
    });

    it('should generate appropriate quantities based on rarity', () => {
      // Test multiple seeds to get a good sample
      for (let seed = 10000; seed < 10010; seed++) {
        const inventory = shopSystem.getDailyInventory(seed);

        for (const shopItem of inventory) {
          if (shopItem.item.rarity === RARITY_TIERS.COMMON) {
            // Common items should have higher quantities (3-7)
            expect(shopItem.quantity).toBeGreaterThanOrEqual(3);
            expect(shopItem.quantity).toBeLessThanOrEqual(7);
          } else if (shopItem.item.rarity === RARITY_TIERS.UNCOMMON) {
            // Uncommon items should have medium quantities (2-4)
            expect(shopItem.quantity).toBeGreaterThanOrEqual(2);
            expect(shopItem.quantity).toBeLessThanOrEqual(4);
          } else {
            // Rare and above should have low quantities (1-2)
            expect(shopItem.quantity).toBeGreaterThanOrEqual(1);
            expect(shopItem.quantity).toBeLessThanOrEqual(2);
          }
        }
      }
    });

    it('should occasionally apply discounts', () => {
      let hasDiscount = false;

      // Check multiple seeds to find at least one discount
      for (let seed = 20000; seed < 20100; seed++) {
        const inventory = shopSystem.getDailyInventory(seed);

        for (const shopItem of inventory) {
          if (shopItem.discountPercent && shopItem.discountPercent > 0) {
            hasDiscount = true;
            // Verify discount is within expected range (10-40%)
            expect(shopItem.discountPercent).toBeGreaterThanOrEqual(10);
            expect(shopItem.discountPercent).toBeLessThanOrEqual(40);
            break;
          }
        }

        if (hasDiscount) break;
      }

      // With 100 seeds and ~10% chance per item, we should find at least one discount
      expect(hasDiscount).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid event IDs gracefully', () => {
      const price = 100;
      const discountedPrice = shopSystem.applyDiscount(price, 'invalid_event');

      // Should return original price for unknown events
      expect(discountedPrice).toBe(price);
    });

    it('should handle zero quantity purchases', () => {
      const inventory = shopSystem.getDailyInventory();
      const shopItem = inventory[0];

      if (shopItem) {
        const result = shopSystem.requestPurchase(shopItem.item.id, 0, gameState);

        // Should still succeed but do nothing
        expect(result).toBe(true);
      }
    });

    it('should validate purchase without queuing when no writer', async () => {
      const newShopSystem = new ShopSystem();
      // Initialize without gameUpdateWriter
      await newShopSystem.initialize();

      newShopSystem.forceRotation(12345);
      const inventory = newShopSystem.getDailyInventory();
      const shopItem = inventory[0];

      if (shopItem) {
        const result = newShopSystem.requestPurchase(shopItem.item.id, 1, gameState);

        // Should still return true (validation passed) but no update queued
        expect(result).toBe(true);
      }
    });
  });
});
