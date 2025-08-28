import { BaseSystem, type SystemInitOptions, type SystemError } from './BaseSystem';
import type { GameUpdateWriter } from '../engine/GameUpdatesQueue';
import type { GameState, GameUpdate } from '../models';
import type { Item } from '../models/Item';
import {
  RARITY_TIERS,
  ITEM_CATEGORIES,
  UPDATE_TYPES,
  type ItemCategory,
  type RarityTier,
} from '../models/constants';

export interface ShopItem {
  item: Item;
  price: number;
  quantity: number;
  discountPercent?: number;
}

export interface ShopInventory {
  items: ShopItem[];
  lastRotation: number; // timestamp of last rotation
  seed: number; // seed used for this rotation
}

export interface ShopTransaction {
  type: 'buy' | 'sell';
  itemId: string;
  quantity: number;
  totalPrice: number;
  timestamp: number;
}

export class ShopSystem extends BaseSystem {
  private currentInventory: ShopInventory | undefined = undefined;
  private itemPools: Map<ItemCategory, Item[]> = new Map();

  // Base price multipliers by rarity
  private readonly rarityPriceMultipliers: Record<RarityTier, number> = {
    [RARITY_TIERS.COMMON]: 1,
    [RARITY_TIERS.UNCOMMON]: 2.5,
    [RARITY_TIERS.RARE]: 5,
    [RARITY_TIERS.EPIC]: 12,
    [RARITY_TIERS.LEGENDARY]: 30,
  };

  // Items per category in daily rotation
  private readonly itemsPerCategory: Partial<Record<ItemCategory, number>> = {
    [ITEM_CATEGORIES.FOOD]: 3,
    [ITEM_CATEGORIES.DRINK]: 3,
    [ITEM_CATEGORIES.TOY]: 2,
    [ITEM_CATEGORIES.MEDICINE]: 2,
    [ITEM_CATEGORIES.BANDAGE]: 1,
    [ITEM_CATEGORIES.HYGIENE]: 2,
    [ITEM_CATEGORIES.ENERGY_BOOSTER]: 1,
    [ITEM_CATEGORIES.TOOL]: 2,
    [ITEM_CATEGORIES.EGG]: 1,
    [ITEM_CATEGORIES.MATERIAL]: 3,
  };

  constructor(gameUpdateWriter: GameUpdateWriter) {
    super('ShopSystem', gameUpdateWriter);
    this.initializeItemPools();
  }

  protected async onInitialize(_options: SystemInitOptions): Promise<void> {
    this.currentInventory = undefined;
    // Shop inventory will be generated on demand
  }

  protected async onShutdown(): Promise<void> {
    this.currentInventory = undefined;
    this.itemPools.clear();
  }

  protected async onReset(): Promise<void> {
    this.currentInventory = undefined;
  }

  protected async onTick(_deltaTime: number, _gameState: GameState): Promise<void> {
    // Check if we need to rotate inventory
    const currentDate = this.getCurrentDateSeed();
    if (!this.currentInventory || this.currentInventory.seed !== currentDate) {
      this.rotateInventory(currentDate);
    }
  }

  protected async onUpdate(_gameState: GameState, _prevState?: GameState): Promise<void> {
    // No specific update logic needed
  }

  protected onError(error: SystemError): void {
    console.error(`[ShopSystem] Error: ${error.error.message}`);
  }

  // Helper function to create items with basePrice
  private createItem(
    id: string,
    name: string,
    category: ItemCategory,
    options: Partial<Item> & { basePrice: number },
  ): Item & { basePrice: number } {
    const { basePrice, ...itemOptions } = options;
    return {
      id,
      name,
      description: itemOptions.description || `A ${name}`,
      category,
      sprite: itemOptions.sprite || `sprites/${id}.png`,
      stackable: itemOptions.stackable !== undefined ? itemOptions.stackable : true,
      maxStack: itemOptions.maxStack || 99,
      sellPrice: itemOptions.sellPrice || Math.floor(basePrice * 0.5),
      buyPrice: itemOptions.buyPrice || basePrice,
      rarity: itemOptions.rarity || RARITY_TIERS.COMMON,
      consumable: itemOptions.consumable !== undefined ? itemOptions.consumable : true,
      ...itemOptions,
      basePrice,
    } as Item & { basePrice: number };
  }

  private initializeItemPools(): void {
    // Initialize item pools for each category
    // These would normally be loaded from config, but we'll create some examples

    // Food items
    this.itemPools.set(ITEM_CATEGORIES.FOOD, [
      this.createItem('apple', 'Apple', ITEM_CATEGORIES.FOOD, {
        rarity: RARITY_TIERS.COMMON,
        basePrice: 10,
      }),
      this.createItem('bread', 'Bread', ITEM_CATEGORIES.FOOD, {
        rarity: RARITY_TIERS.COMMON,
        basePrice: 15,
      }),
      this.createItem('fish', 'Fish', ITEM_CATEGORIES.FOOD, {
        rarity: RARITY_TIERS.UNCOMMON,
        basePrice: 30,
      }),
      this.createItem('steak', 'Steak', ITEM_CATEGORIES.FOOD, {
        rarity: RARITY_TIERS.RARE,
        basePrice: 50,
      }),
      this.createItem('golden_apple', 'Golden Apple', ITEM_CATEGORIES.FOOD, {
        rarity: RARITY_TIERS.EPIC,
        basePrice: 100,
      }),
    ]);

    // Drink items
    this.itemPools.set(ITEM_CATEGORIES.DRINK, [
      this.createItem('water', 'Water', ITEM_CATEGORIES.DRINK, {
        rarity: RARITY_TIERS.COMMON,
        basePrice: 5,
      }),
      this.createItem('juice', 'Juice', ITEM_CATEGORIES.DRINK, {
        rarity: RARITY_TIERS.COMMON,
        basePrice: 12,
      }),
      this.createItem('milk', 'Milk', ITEM_CATEGORIES.DRINK, {
        rarity: RARITY_TIERS.UNCOMMON,
        basePrice: 20,
      }),
      this.createItem('energy_drink', 'Energy Drink', ITEM_CATEGORIES.DRINK, {
        rarity: RARITY_TIERS.RARE,
        basePrice: 40,
      }),
      this.createItem('elixir', 'Elixir', ITEM_CATEGORIES.DRINK, {
        rarity: RARITY_TIERS.EPIC,
        basePrice: 80,
      }),
    ]);

    // Toy items
    this.itemPools.set(ITEM_CATEGORIES.TOY, [
      this.createItem('ball', 'Ball', ITEM_CATEGORIES.TOY, {
        rarity: RARITY_TIERS.COMMON,
        basePrice: 15,
      }),
      this.createItem('stuffed_toy', 'Stuffed Toy', ITEM_CATEGORIES.TOY, {
        rarity: RARITY_TIERS.UNCOMMON,
        basePrice: 30,
      }),
      this.createItem('puzzle', 'Puzzle', ITEM_CATEGORIES.TOY, {
        rarity: RARITY_TIERS.RARE,
        basePrice: 50,
      }),
      this.createItem('magical_toy', 'Magical Toy', ITEM_CATEGORIES.TOY, {
        rarity: RARITY_TIERS.EPIC,
        basePrice: 100,
      }),
    ]);

    // Medicine items
    this.itemPools.set(ITEM_CATEGORIES.MEDICINE, [
      this.createItem('basic_medicine', 'Basic Medicine', ITEM_CATEGORIES.MEDICINE, {
        rarity: RARITY_TIERS.COMMON,
        basePrice: 20,
      }),
      this.createItem('strong_medicine', 'Strong Medicine', ITEM_CATEGORIES.MEDICINE, {
        rarity: RARITY_TIERS.UNCOMMON,
        basePrice: 40,
      }),
      this.createItem('super_medicine', 'Super Medicine', ITEM_CATEGORIES.MEDICINE, {
        rarity: RARITY_TIERS.RARE,
        basePrice: 80,
      }),
    ]);

    // Bandage items
    this.itemPools.set(ITEM_CATEGORIES.BANDAGE, [
      this.createItem('bandage', 'Bandage', ITEM_CATEGORIES.BANDAGE, {
        rarity: RARITY_TIERS.COMMON,
        basePrice: 15,
      }),
      this.createItem('medical_kit', 'Medical Kit', ITEM_CATEGORIES.BANDAGE, {
        rarity: RARITY_TIERS.UNCOMMON,
        basePrice: 35,
      }),
    ]);

    // Hygiene items
    this.itemPools.set(ITEM_CATEGORIES.HYGIENE, [
      this.createItem('wet_wipe', 'Wet Wipe', ITEM_CATEGORIES.HYGIENE, {
        rarity: RARITY_TIERS.COMMON,
        basePrice: 10,
      }),
      this.createItem('cleaning_spray', 'Cleaning Spray', ITEM_CATEGORIES.HYGIENE, {
        rarity: RARITY_TIERS.COMMON,
        basePrice: 30,
      }),
      this.createItem('disinfectant', 'Disinfectant', ITEM_CATEGORIES.HYGIENE, {
        rarity: RARITY_TIERS.UNCOMMON,
        basePrice: 50,
      }),
      this.createItem('premium_cleaner', 'Premium Pet Cleaner', ITEM_CATEGORIES.HYGIENE, {
        rarity: RARITY_TIERS.RARE,
        basePrice: 100,
      }),
    ]);

    // Energy booster items
    this.itemPools.set(ITEM_CATEGORIES.ENERGY_BOOSTER, [
      this.createItem('energy_bar', 'Energy Bar', ITEM_CATEGORIES.ENERGY_BOOSTER, {
        rarity: RARITY_TIERS.COMMON,
        basePrice: 25,
      }),
      this.createItem('power_drink', 'Power Drink', ITEM_CATEGORIES.ENERGY_BOOSTER, {
        rarity: RARITY_TIERS.UNCOMMON,
        basePrice: 50,
      }),
      this.createItem('max_energy', 'Max Energy', ITEM_CATEGORIES.ENERGY_BOOSTER, {
        rarity: RARITY_TIERS.RARE,
        basePrice: 100,
      }),
    ]);

    // Tool items
    this.itemPools.set(ITEM_CATEGORIES.TOOL, [
      this.createItem('fishing_rod', 'Fishing Rod', ITEM_CATEGORIES.TOOL, {
        rarity: RARITY_TIERS.COMMON,
        basePrice: 50,
      }),
      this.createItem('pickaxe', 'Pickaxe', ITEM_CATEGORIES.TOOL, {
        rarity: RARITY_TIERS.COMMON,
        basePrice: 60,
      }),
      this.createItem('golden_fishing_rod', 'Golden Fishing Rod', ITEM_CATEGORIES.TOOL, {
        rarity: RARITY_TIERS.RARE,
        basePrice: 150,
      }),
      this.createItem('diamond_pickaxe', 'Diamond Pickaxe', ITEM_CATEGORIES.TOOL, {
        rarity: RARITY_TIERS.EPIC,
        basePrice: 300,
      }),
    ]);

    // Egg items
    this.itemPools.set(ITEM_CATEGORIES.EGG, [
      this.createItem('common_egg', 'Common Egg', ITEM_CATEGORIES.EGG, {
        rarity: RARITY_TIERS.COMMON,
        basePrice: 100,
      }),
      this.createItem('uncommon_egg', 'Uncommon Egg', ITEM_CATEGORIES.EGG, {
        rarity: RARITY_TIERS.UNCOMMON,
        basePrice: 250,
      }),
      this.createItem('rare_egg', 'Rare Egg', ITEM_CATEGORIES.EGG, {
        rarity: RARITY_TIERS.RARE,
        basePrice: 500,
      }),
      this.createItem('epic_egg', 'Epic Egg', ITEM_CATEGORIES.EGG, {
        rarity: RARITY_TIERS.EPIC,
        basePrice: 1000,
      }),
    ]);

    // Material items (skip egg_fragment as it's not in ITEM_CATEGORIES)
    this.itemPools.set(ITEM_CATEGORIES.MATERIAL, [
      this.createItem('wood', 'Wood', ITEM_CATEGORIES.MATERIAL, {
        rarity: RARITY_TIERS.COMMON,
        basePrice: 5,
      }),
      this.createItem('stone', 'Stone', ITEM_CATEGORIES.MATERIAL, {
        rarity: RARITY_TIERS.COMMON,
        basePrice: 8,
      }),
      this.createItem('iron_ore', 'Iron Ore', ITEM_CATEGORIES.MATERIAL, {
        rarity: RARITY_TIERS.UNCOMMON,
        basePrice: 20,
      }),
      this.createItem('gold_ore', 'Gold Ore', ITEM_CATEGORIES.MATERIAL, {
        rarity: RARITY_TIERS.RARE,
        basePrice: 50,
      }),
      this.createItem('diamond', 'Diamond', ITEM_CATEGORIES.MATERIAL, {
        rarity: RARITY_TIERS.EPIC,
        basePrice: 200,
      }),
    ]);
  }

  private getCurrentDateSeed(): number {
    // Generate a seed based on the current date (YYYYMMDD format)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return parseInt(`${year}${month}${day}`, 10);
  }

  private seededRandom(seed: number): () => number {
    // Simple seeded random number generator
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  private rotateInventory(seed: number): void {
    const random = this.seededRandom(seed);
    const items: ShopItem[] = [];

    // Generate items for each category
    for (const [category, count] of Object.entries(this.itemsPerCategory)) {
      const pool = this.itemPools.get(category as ItemCategory);
      if (!pool || pool.length === 0) continue;

      for (let i = 0; i < count; i++) {
        // Select a random item from the pool
        const itemIndex = Math.floor(random() * pool.length);
        const baseItem = pool[itemIndex];
        if (!baseItem) continue;

        // Determine quantity based on rarity
        let quantity = 1;
        if (baseItem.rarity === RARITY_TIERS.COMMON) {
          quantity = Math.floor(random() * 5) + 3; // 3-7
        } else if (baseItem.rarity === RARITY_TIERS.UNCOMMON) {
          quantity = Math.floor(random() * 3) + 2; // 2-4
        } else {
          quantity = Math.floor(random() * 2) + 1; // 1-2
        }

        // Calculate price - cast to our extended type
        const itemWithPrice = baseItem as Item & { basePrice?: number };
        const basePrice = itemWithPrice.basePrice || 10;
        const rarityMultiplier = this.rarityPriceMultipliers[baseItem.rarity] || 1;
        const price = Math.round(basePrice * rarityMultiplier);

        // Small chance for discount
        let discountPercent = 0;
        if (random() < 0.1) {
          // 10% chance for discount
          discountPercent = Math.floor(random() * 30) + 10; // 10-40% discount
        }

        items.push({
          item: { ...baseItem },
          price,
          quantity,
          discountPercent,
        });
      }
    }

    this.currentInventory = {
      items,
      lastRotation: Date.now(),
      seed,
    };
  }

  getDailyInventory(seed?: number): ShopItem[] {
    const currentSeed = seed || this.getCurrentDateSeed();

    if (!this.currentInventory || this.currentInventory.seed !== currentSeed) {
      this.rotateInventory(currentSeed);
    }

    return this.currentInventory!.items;
  }

  getItemPrice(item: Item, eventId?: string): number {
    const itemWithPrice = item as Item & { basePrice?: number };
    const basePrice = itemWithPrice.basePrice || item.buyPrice || 10;
    const rarityMultiplier = this.rarityPriceMultipliers[item.rarity] || 1;
    let price = Math.round(basePrice * rarityMultiplier);

    // Apply event discount if applicable
    if (eventId) {
      price = this.applyDiscount(price, eventId);
    }

    return price;
  }

  applyDiscount(price: number, eventId?: string): number {
    if (!eventId) return price;

    // Check for event-specific discounts
    const eventDiscounts: Record<string, number> = {
      summer_festival: 0.2, // 20% off
      winter_sale: 0.3, // 30% off
      anniversary: 0.25, // 25% off
      weekend_sale: 0.15, // 15% off
    };

    const discountRate = eventDiscounts[eventId] || 0;
    return Math.round(price * (1 - discountRate));
  }

  validatePurchase(
    itemId: string,
    quantity: number,
    playerCoins: number,
    eventId?: string,
  ): { valid: boolean; price?: number; item?: Item; message?: string } {
    // Find the item in current inventory
    const shopItem = this.currentInventory?.items.find((si) => si.item.id === itemId);

    if (!shopItem) {
      return {
        valid: false,
        message: `Item ${itemId} not found in shop`,
      };
    }

    if (shopItem.quantity < quantity) {
      return {
        valid: false,
        message: `Not enough quantity in shop. Available: ${shopItem.quantity}`,
      };
    }

    // Calculate total price
    let unitPrice = shopItem.price;
    if (shopItem.discountPercent) {
      unitPrice = Math.round(unitPrice * (1 - shopItem.discountPercent / 100));
    }
    if (eventId) {
      unitPrice = this.applyDiscount(unitPrice, eventId);
    }
    const totalPrice = unitPrice * quantity;

    // Check if player has enough currency
    if (playerCoins < totalPrice) {
      return {
        valid: false,
        message: `Insufficient funds. Need: ${totalPrice}, Have: ${playerCoins}`,
      };
    }

    return {
      valid: true,
      price: totalPrice,
      item: shopItem.item,
    };
  }

  requestPurchase(itemId: string, quantity: number, state: GameState, eventId?: string): boolean {
    // Validate the purchase
    const validation = this.validatePurchase(
      itemId,
      quantity,
      state.inventory.currency.coins,
      eventId,
    );

    if (!validation.valid) {
      console.error(validation.message);
      return false;
    }

    // Queue a purchase request update for GameEngine to handle
    if (this.gameUpdateWriter) {
      const update: GameUpdate = {
        id: `shop-purchase-${Date.now()}`,
        type: UPDATE_TYPES.USER_ACTION,
        timestamp: Date.now(),
        payload: {
          action: 'SHOP_PURCHASE',
          data: {
            itemId,
            quantity,
            price: validation.price,
            item: validation.item,
            eventId,
          },
        },
      };
      this.gameUpdateWriter.enqueue(update);
    }

    // Update local shop inventory optimistically
    const shopItem = this.currentInventory?.items.find((si) => si.item.id === itemId);
    if (shopItem) {
      shopItem.quantity -= quantity;
    }

    return true;
  }

  calculateSellPrice(item: Item): number {
    const buyPrice = this.getItemPrice(item);
    return Math.round(buyPrice * 0.5);
  }

  requestSell(item: Item, quantity: number): boolean {
    // Calculate sell price
    const sellPrice = this.calculateSellPrice(item);
    const totalPrice = sellPrice * quantity;

    // Queue a sell request update for GameEngine to handle
    if (this.gameUpdateWriter) {
      const update: GameUpdate = {
        id: `shop-sell-${Date.now()}`,
        type: UPDATE_TYPES.USER_ACTION,
        timestamp: Date.now(),
        payload: {
          action: 'SHOP_SELL',
          data: {
            itemId: item.id,
            quantity,
            price: totalPrice,
            item,
          },
        },
      };
      this.gameUpdateWriter.enqueue(update);
    }

    return true;
  }

  getShopInventory(): ShopInventory | undefined {
    return this.currentInventory;
  }

  forceRotation(seed?: number): void {
    const newSeed = seed || this.getCurrentDateSeed();
    this.rotateInventory(newSeed);
  }
}
