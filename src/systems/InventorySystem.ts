/**
 * InventorySystem - Manages items, currency, and inventory operations
 */

import { BaseSystem, type SystemInitOptions, type SystemError } from './BaseSystem';
import type { GameUpdateWriter } from '../engine/GameUpdatesQueue';
import type { GameState, GameUpdate, InventoryItem } from '../models';
import type {
  Item,
  ToolItem,
  ItemEffectResult,
  FoodItem,
  DrinkItem,
  ToyItem,
  MedicineItem,
  EnergyBoosterItem,
} from '../models/Item';
import {
  UPDATE_TYPES,
  ITEM_CATEGORIES,
  STACK_LIMITS,
  type ItemCategory,
} from '../models/constants';

/**
 * Inventory operation result
 */
export interface InventoryOperationResult {
  success: boolean;
  message: string;
  items?: InventoryItem[];
  overflow?: InventoryItem[];
}

/**
 * Currency transaction result
 */
export interface CurrencyTransaction {
  success: boolean;
  previousAmount: number;
  newAmount: number;
  change: number;
  message: string;
}

/**
 * Item filter options
 */
export interface ItemFilterOptions {
  category?: ItemCategory;
  stackable?: boolean;
  consumable?: boolean;
  minQuantity?: number;
  searchTerm?: string;
}

/**
 * Item sort options
 */
export type ItemSortOption = 'name' | 'category' | 'quantity' | 'recent' | 'value';

/**
 * Inventory statistics
 */
export interface InventoryStats {
  totalItems: number;
  totalStacks: number;
  usedSlots: number;
  maxSlots: number;
  totalValue: number;
  categoryCounts: Record<ItemCategory, number>;
}

/**
 * InventorySystem class
 */
export class InventorySystem extends BaseSystem {
  private itemDefinitions: Map<string, Item> = new Map();
  private cooldowns: Map<string, number> = new Map(); // Item usage cooldowns

  constructor(gameUpdateWriter: GameUpdateWriter) {
    super('InventorySystem', gameUpdateWriter);
  }

  /**
   * System initialization
   */
  protected async onInitialize(options: SystemInitOptions): Promise<void> {
    // Load item definitions from config passed by GameEngine
    const itemsConfig = options.config?.items;
    if (itemsConfig) {
      this.loadItemDefinitions(itemsConfig);
    } else {
      console.warn('[InventorySystem] No items config provided');
    }
  }

  /**
   * System shutdown
   */
  protected async onShutdown(): Promise<void> {
    this.itemDefinitions.clear();
    this.cooldowns.clear();
  }

  /**
   * System reset
   */
  protected async onReset(): Promise<void> {
    this.cooldowns.clear();
  }

  /**
   * Process tick
   */
  protected async onTick(_deltaTime: number, _gameState: GameState): Promise<void> {
    // Update cooldowns
    const now = Date.now();
    for (const [itemId, cooldownEnd] of this.cooldowns.entries()) {
      if (now >= cooldownEnd) {
        this.cooldowns.delete(itemId);
      }
    }
  }

  /**
   * Process update
   */
  protected async onUpdate(_gameState: GameState, _prevState?: GameState): Promise<void> {
    // No specific update logic needed
  }

  /**
   * Handle system error
   */
  protected onError(error: SystemError): void {
    console.error(`[InventorySystem] Error: ${error.error.message}`);
  }

  /**
   * Load item definitions from config
   */
  private loadItemDefinitions(itemsConfig: any): void {
    if (Array.isArray(itemsConfig)) {
      for (const item of itemsConfig) {
        this.itemDefinitions.set(item.id, item);
      }
    }
  }

  /**
   * Get item definition
   */
  public getItemDefinition(itemId: string): Item | undefined {
    return this.itemDefinitions.get(itemId);
  }

  /**
   * Add item to inventory
   */
  public addItem(
    gameState: GameState,
    itemId: string,
    quantity: number,
    customData?: Record<string, any>,
  ): InventoryOperationResult {
    const itemDef = this.getItemDefinition(itemId);
    if (!itemDef) {
      return {
        success: false,
        message: `Item ${itemId} not found`,
      };
    }

    const inventory = gameState.inventory.items;
    const maxSlots = gameState.inventory.maxSlots;
    const overflow: InventoryItem[] = [];

    // Check if item is stackable
    if (itemDef.stackable) {
      // Try to find existing stack
      const existingStack = inventory.find((invItem) => invItem.itemId === itemId);

      if (existingStack) {
        // Add to existing stack
        const maxStack = itemDef.maxStack || STACK_LIMITS.DEFAULT;
        const availableSpace = maxStack - existingStack.quantity;

        if (availableSpace > 0) {
          const toAdd = Math.min(availableSpace, quantity);
          existingStack.quantity += toAdd;
          quantity -= toAdd;
        }
      }

      // Create new stacks for remaining quantity
      while (quantity > 0 && inventory.length < maxSlots) {
        const maxStack = itemDef.maxStack || STACK_LIMITS.DEFAULT;
        const stackSize = Math.min(quantity, maxStack);

        const newItem: InventoryItem = {
          itemId,
          quantity: stackSize,
          obtainedTime: Date.now(),
          customData,
        };

        // Add durability for tools
        if (itemDef.category === ITEM_CATEGORIES.TOOL) {
          const toolDef = itemDef as ToolItem;
          newItem.currentDurability = toolDef.durability;
        }

        inventory.push(newItem);
        quantity -= stackSize;
      }

      // Handle overflow
      if (quantity > 0) {
        const maxStack = itemDef.maxStack || STACK_LIMITS.DEFAULT;
        while (quantity > 0) {
          const stackSize = Math.min(quantity, maxStack);
          overflow.push({
            itemId,
            quantity: stackSize,
            obtainedTime: Date.now(),
            customData,
          });
          quantity -= stackSize;
        }
      }
    } else {
      // Non-stackable items
      for (let i = 0; i < quantity; i++) {
        if (inventory.length < maxSlots) {
          const newItem: InventoryItem = {
            itemId,
            quantity: 1,
            obtainedTime: Date.now(),
            customData,
          };

          // Add durability for tools
          if (itemDef.category === ITEM_CATEGORIES.TOOL) {
            const toolDef = itemDef as ToolItem;
            newItem.currentDurability = toolDef.durability;
          }

          inventory.push(newItem);
        } else {
          overflow.push({
            itemId,
            quantity: 1,
            obtainedTime: Date.now(),
            customData,
          });
        }
      }
    }

    // Queue inventory update
    if (this.gameUpdateWriter) {
      const update: GameUpdate = {
        id: `inventory-add-${Date.now()}`,
        type: UPDATE_TYPES.STATE_TRANSITION,
        timestamp: Date.now(),
        priority: 0,
        payload: {
          action: 'INVENTORY_UPDATED',
          data: {
            added: itemId,
            quantity: quantity - overflow.reduce((sum, item) => sum + item.quantity, 0),
          },
        },
      };
      this.gameUpdateWriter.enqueue(update);
    }

    return {
      success: true,
      message:
        overflow.length > 0
          ? `Added items, but ${overflow.length} didn't fit`
          : 'Items added successfully',
      items: inventory,
      overflow: overflow.length > 0 ? overflow : undefined,
    };
  }

  /**
   * Remove item from inventory
   */
  public removeItem(
    gameState: GameState,
    itemId: string,
    quantity: number,
  ): InventoryOperationResult {
    const inventory = gameState.inventory.items;
    const itemsToRemove: number[] = [];
    let remainingQuantity = quantity;

    // Find items to remove
    for (let i = 0; i < inventory.length && remainingQuantity > 0; i++) {
      const invItem = inventory[i];
      if (invItem && invItem.itemId === itemId) {
        if (invItem.quantity <= remainingQuantity) {
          remainingQuantity -= invItem.quantity;
          itemsToRemove.push(i);
        } else {
          invItem.quantity -= remainingQuantity;
          remainingQuantity = 0;
        }
      }
    }

    // Check if we have enough items
    if (remainingQuantity > 0) {
      return {
        success: false,
        message: `Not enough items. Missing ${remainingQuantity}`,
      };
    }

    // Remove items (in reverse order to maintain indices)
    for (let i = itemsToRemove.length - 1; i >= 0; i--) {
      const indexToRemove = itemsToRemove[i];
      if (indexToRemove !== undefined) {
        inventory.splice(indexToRemove, 1);
      }
    }

    // Queue inventory update
    if (this.gameUpdateWriter) {
      const update: GameUpdate = {
        id: `inventory-remove-${Date.now()}`,
        type: UPDATE_TYPES.STATE_TRANSITION,
        timestamp: Date.now(),
        priority: 0,
        payload: {
          action: 'INVENTORY_UPDATED',
          data: {
            removed: itemId,
            quantity,
          },
        },
      };
      this.gameUpdateWriter.enqueue(update);
    }

    return {
      success: true,
      message: 'Items removed successfully',
      items: inventory,
    };
  }

  /**
   * Use an item
   */
  public useItem(gameState: GameState, itemId: string, quantity: number = 1): ItemEffectResult {
    // Check cooldown
    if (this.cooldowns.has(itemId)) {
      return {
        success: false,
        message: 'Item is on cooldown',
      };
    }

    const itemDef = this.getItemDefinition(itemId);
    if (!itemDef) {
      return {
        success: false,
        message: 'Item not found',
      };
    }

    // Check if we have the item
    const hasItem = this.hasItem(gameState, itemId, quantity);
    if (!hasItem) {
      return {
        success: false,
        message: 'Not enough items in inventory',
      };
    }

    // Check if item is consumable
    if (!itemDef.consumable) {
      return {
        success: false,
        message: 'Item is not consumable',
      };
    }

    // Apply item effects based on category
    const result = this.applyItemEffects(gameState, itemDef, quantity);

    if (result.success) {
      // Remove consumed items
      if (itemDef.consumable) {
        this.removeItem(gameState, itemId, quantity);
      }

      // Apply cooldown if needed
      if (itemDef.category === ITEM_CATEGORIES.ENERGY_BOOSTER) {
        const booster = itemDef as EnergyBoosterItem;
        if (booster.cooldownMinutes) {
          const cooldownMs = booster.cooldownMinutes * 60 * 1000;
          this.cooldowns.set(itemId, Date.now() + cooldownMs);
        }
      }
    }

    return result;
  }

  /**
   * Apply item effects
   */
  private applyItemEffects(gameState: GameState, item: Item, quantity: number): ItemEffectResult {
    const changes: any = {};
    const sideEffects: any[] = [];

    switch (item.category) {
      case ITEM_CATEGORIES.FOOD: {
        const food = item as FoodItem;
        changes.satiety = food.satietyRestore * quantity;
        if (food.happinessBonus) {
          changes.happiness = food.happinessBonus * quantity;
        }
        if (food.specialEffect) {
          sideEffects.push({
            type: food.specialEffect.type,
            description: `Special effect: ${food.specialEffect.type}`,
            duration: food.specialEffect.duration,
          });
        }
        break;
      }

      case ITEM_CATEGORIES.DRINK: {
        const drink = item as DrinkItem;
        changes.hydration = drink.hydrationRestore * quantity;
        if (drink.energyBonus) {
          changes.energy = drink.energyBonus * quantity;
        }
        if (drink.specialEffect) {
          sideEffects.push({
            type: drink.specialEffect.type,
            description: `Special effect: ${drink.specialEffect.type}`,
            duration: drink.specialEffect.duration,
          });
        }
        break;
      }

      case ITEM_CATEGORIES.TOY: {
        const toy = item as ToyItem;
        // Check energy requirement
        if (gameState.pet && gameState.pet.energy < toy.energyCost) {
          return {
            success: false,
            message: 'Not enough energy to play',
          };
        }
        changes.happiness = toy.happinessIncrease * quantity;
        changes.energy = -(toy.energyCost * quantity);

        // Handle durability
        if (toy.durability !== undefined) {
          this.reduceDurability(gameState, item.id, quantity);
        }
        break;
      }

      case ITEM_CATEGORIES.MEDICINE: {
        const medicine = item as MedicineItem;
        changes.curedStatus = [medicine.curesStatus];
        if (medicine.healingAmount) {
          changes.health = medicine.healingAmount * quantity;
        }
        break;
      }

      case ITEM_CATEGORIES.BANDAGE: {
        changes.curedStatus = ['INJURED'];
        // Additional healing logic would go here
        break;
      }

      case ITEM_CATEGORIES.ENERGY_BOOSTER: {
        const booster = item as EnergyBoosterItem;
        changes.energy = booster.energyRestore * quantity;
        if (booster.sideEffect) {
          sideEffects.push({
            type: booster.sideEffect.type,
            description: `Side effect: ${booster.sideEffect.type}`,
            duration: booster.sideEffect.duration,
          });
        }
        break;
      }

      default:
        return {
          success: false,
          message: `Cannot use item of category ${item.category}`,
        };
    }

    return {
      success: true,
      message: `Used ${quantity}x ${item.name}`,
      changes,
      sideEffects: sideEffects.length > 0 ? sideEffects : undefined,
    };
  }

  /**
   * Reduce item durability
   */
  public reduceDurability(gameState: GameState, itemId: string, amount: number = 1): boolean {
    const inventory = gameState.inventory.items;

    for (const invItem of inventory) {
      if (invItem.itemId === itemId && invItem.currentDurability !== undefined) {
        invItem.currentDurability -= amount;

        // Remove item if durability reaches 0
        if (invItem.currentDurability <= 0) {
          const index = inventory.indexOf(invItem);
          if (index > -1) {
            inventory.splice(index, 1);
          }

          // Queue notification
          if (this.gameUpdateWriter) {
            const update: GameUpdate = {
              id: `item-broken-${Date.now()}`,
              type: UPDATE_TYPES.STATE_TRANSITION,
              timestamp: Date.now(),
              priority: 1,
              payload: {
                action: 'ITEM_BROKEN',
                data: { itemId },
              },
            };
            this.gameUpdateWriter.enqueue(update);
          }
        }

        return true;
      }
    }

    return false;
  }

  /**
   * Check if player has enough items
   */
  public hasItem(gameState: GameState, itemId: string, quantity: number = 1): boolean {
    const totalQuantity = this.getItemQuantity(gameState, itemId);
    return totalQuantity >= quantity;
  }

  /**
   * Get total quantity of an item
   */
  public getItemQuantity(gameState: GameState, itemId: string): number {
    return gameState.inventory.items
      .filter((item) => item.itemId === itemId)
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  /**
   * Add currency
   */
  public addCurrency(gameState: GameState, amount: number): CurrencyTransaction {
    const previousAmount = gameState.inventory.currency.coins;
    const maxCurrency = STACK_LIMITS.CURRENCY;

    const newAmount = Math.min(previousAmount + amount, maxCurrency);
    const actualChange = newAmount - previousAmount;

    gameState.inventory.currency.coins = newAmount;

    // Queue currency update
    if (this.gameUpdateWriter) {
      const update: GameUpdate = {
        id: `currency-add-${Date.now()}`,
        type: UPDATE_TYPES.STATE_TRANSITION,
        timestamp: Date.now(),
        priority: 0,
        payload: {
          action: 'CURRENCY_UPDATED',
          data: {
            type: 'coins',
            change: actualChange,
            newAmount,
          },
        },
      };
      this.gameUpdateWriter.enqueue(update);
    }

    return {
      success: true,
      previousAmount,
      newAmount,
      change: actualChange,
      message:
        actualChange < amount
          ? `Added ${actualChange} coins (max reached)`
          : `Added ${amount} coins`,
    };
  }

  /**
   * Remove currency
   */
  public removeCurrency(gameState: GameState, amount: number): CurrencyTransaction {
    const previousAmount = gameState.inventory.currency.coins;

    if (previousAmount < amount) {
      return {
        success: false,
        previousAmount,
        newAmount: previousAmount,
        change: 0,
        message: `Not enough coins. Need ${amount}, have ${previousAmount}`,
      };
    }

    const newAmount = previousAmount - amount;
    gameState.inventory.currency.coins = newAmount;

    // Queue currency update
    if (this.gameUpdateWriter) {
      const update: GameUpdate = {
        id: `currency-remove-${Date.now()}`,
        type: UPDATE_TYPES.STATE_TRANSITION,
        timestamp: Date.now(),
        priority: 0,
        payload: {
          action: 'CURRENCY_UPDATED',
          data: {
            type: 'coins',
            change: -amount,
            newAmount,
          },
        },
      };
      this.gameUpdateWriter.enqueue(update);
    }

    return {
      success: true,
      previousAmount,
      newAmount,
      change: -amount,
      message: `Spent ${amount} coins`,
    };
  }

  /**
   * Check if player has enough currency
   */
  public hasCurrency(gameState: GameState, amount: number): boolean {
    return gameState.inventory.currency.coins >= amount;
  }

  /**
   * Sort inventory
   */
  public sortInventory(gameState: GameState, sortBy: ItemSortOption = 'category'): void {
    const inventory = gameState.inventory.items;

    inventory.sort((a, b) => {
      const itemA = this.getItemDefinition(a.itemId);
      const itemB = this.getItemDefinition(b.itemId);

      if (!itemA || !itemB) return 0;

      switch (sortBy) {
        case 'name':
          return itemA.name.localeCompare(itemB.name);

        case 'category':
          if (itemA.category !== itemB.category) {
            return itemA.category.localeCompare(itemB.category);
          }
          return itemA.name.localeCompare(itemB.name);

        case 'quantity':
          return b.quantity - a.quantity;

        case 'recent':
          return b.obtainedTime - a.obtainedTime;

        case 'value':
          return itemB.sellPrice * b.quantity - itemA.sellPrice * a.quantity;

        default:
          return 0;
      }
    });
  }

  /**
   * Filter inventory
   */
  public filterInventory(gameState: GameState, options: ItemFilterOptions): InventoryItem[] {
    let filtered = [...gameState.inventory.items];

    if (options.category) {
      filtered = filtered.filter((item) => {
        const itemDef = this.getItemDefinition(item.itemId);
        return itemDef?.category === options.category;
      });
    }

    if (options.stackable !== undefined) {
      filtered = filtered.filter((item) => {
        const itemDef = this.getItemDefinition(item.itemId);
        return itemDef?.stackable === options.stackable;
      });
    }

    if (options.consumable !== undefined) {
      filtered = filtered.filter((item) => {
        const itemDef = this.getItemDefinition(item.itemId);
        return itemDef?.consumable === options.consumable;
      });
    }

    if (options.minQuantity !== undefined) {
      filtered = filtered.filter((item) => item.quantity >= options.minQuantity!);
    }

    if (options.searchTerm) {
      const search = options.searchTerm.toLowerCase();
      filtered = filtered.filter((item) => {
        const itemDef = this.getItemDefinition(item.itemId);
        return (
          itemDef?.name.toLowerCase().includes(search) ||
          itemDef?.description.toLowerCase().includes(search)
        );
      });
    }

    return filtered;
  }

  /**
   * Get inventory statistics
   */
  public getInventoryStats(gameState: GameState): InventoryStats {
    const inventory = gameState.inventory.items;
    const categoryCounts: Record<ItemCategory, number> = {} as any;

    // Initialize category counts
    for (const category of Object.values(ITEM_CATEGORIES)) {
      categoryCounts[category as ItemCategory] = 0;
    }

    let totalValue = 0;
    let totalItems = 0;

    for (const invItem of inventory) {
      const itemDef = this.getItemDefinition(invItem.itemId);
      if (itemDef) {
        const category = itemDef.category;
        if (category in categoryCounts) {
          categoryCounts[category] += invItem.quantity;
        }
        totalValue += itemDef.sellPrice * invItem.quantity;
        totalItems += invItem.quantity;
      }
    }

    return {
      totalItems,
      totalStacks: inventory.length,
      usedSlots: inventory.length,
      maxSlots: gameState.inventory.maxSlots,
      totalValue,
      categoryCounts,
    };
  }

  /**
   * Check if inventory is full
   */
  public isInventoryFull(gameState: GameState): boolean {
    return gameState.inventory.items.length >= gameState.inventory.maxSlots;
  }

  /**
   * Get available inventory space
   */
  public getAvailableSpace(gameState: GameState): number {
    return gameState.inventory.maxSlots - gameState.inventory.items.length;
  }

  /**
   * Expand inventory slots
   */
  public expandInventory(gameState: GameState, additionalSlots: number): boolean {
    const currentMax = gameState.inventory.maxSlots;
    const newMax = currentMax + additionalSlots;

    // Check if expansion is allowed (could add max limit)
    const absoluteMax = 200; // Example max limit
    if (newMax > absoluteMax) {
      return false;
    }

    gameState.inventory.maxSlots = newMax;
    gameState.inventory.unlockedSlots = Math.max(gameState.inventory.unlockedSlots, newMax);

    return true;
  }

  /**
   * Clear expired items (like event tokens after event ends)
   */
  public clearExpiredItems(gameState: GameState, expiredItemIds: string[]): number {
    const inventory = gameState.inventory.items;
    let removedCount = 0;

    for (let i = inventory.length - 1; i >= 0; i--) {
      const invItem = inventory[i];
      if (invItem && expiredItemIds.includes(invItem.itemId)) {
        removedCount += invItem.quantity;
        inventory.splice(i, 1);
      }
    }

    return removedCount;
  }

  /**
   * Transfer items between inventories (for future features like storage)
   */
  public transferItems(
    fromInventory: InventoryItem[],
    toInventory: InventoryItem[],
    itemId: string,
    quantity: number,
    maxSlots: number,
  ): InventoryOperationResult {
    // Find source item
    const sourceItem = fromInventory.find((item) => item.itemId === itemId);
    if (!sourceItem || sourceItem.quantity < quantity) {
      return {
        success: false,
        message: 'Not enough items to transfer',
      };
    }

    // Check destination space
    if (toInventory.length >= maxSlots) {
      const itemDef = this.getItemDefinition(itemId);
      if (!itemDef?.stackable) {
        return {
          success: false,
          message: 'Destination inventory is full',
        };
      }

      // Check if can stack with existing
      const destItem = toInventory.find((item) => item.itemId === itemId);
      if (!destItem) {
        return {
          success: false,
          message: 'Destination inventory is full',
        };
      }

      const maxStack = itemDef.maxStack || STACK_LIMITS.DEFAULT;
      if (destItem.quantity + quantity > maxStack) {
        return {
          success: false,
          message: 'Would exceed stack limit',
        };
      }
    }

    // Perform transfer
    sourceItem.quantity -= quantity;
    if (sourceItem.quantity <= 0) {
      const index = fromInventory.indexOf(sourceItem);
      if (index > -1) {
        fromInventory.splice(index, 1);
      }
    }

    // Add to destination
    const itemDef = this.getItemDefinition(itemId);
    if (itemDef?.stackable) {
      const destItem = toInventory.find((item) => item.itemId === itemId);
      if (destItem) {
        destItem.quantity += quantity;
      } else {
        toInventory.push({
          itemId,
          quantity,
          obtainedTime: Date.now(),
        });
      }
    } else {
      for (let i = 0; i < quantity; i++) {
        toInventory.push({
          itemId,
          quantity: 1,
          obtainedTime: Date.now(),
        });
      }
    }

    return {
      success: true,
      message: `Transferred ${quantity}x items`,
    };
  }
}
