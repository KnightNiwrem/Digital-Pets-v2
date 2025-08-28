import React, { useState, useMemo } from 'react';
import type { GameState, InventoryItem } from '../models';
import type { Item } from '../models/Item';
import { ITEM_CATEGORIES, type ItemCategory } from '../models/constants';
import { getItemById } from '../data/items';

interface InventoryScreenProps {
  gameState: GameState;
  isOpen: boolean;
  onClose: () => void;
  onUseItem: (itemId: string, quantity: number) => void;
}

export const InventoryScreen: React.FC<InventoryScreenProps> = ({
  gameState,
  isOpen,
  onClose,
  onUseItem,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'ALL'>('ALL');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Get item definitions for all inventory items
  const inventoryWithDefinitions = useMemo(() => {
    return gameState.inventory.items.map((invItem) => ({
      inventoryItem: invItem,
      itemDef: getItemById(invItem.itemId),
    }));
  }, [gameState.inventory.items]);

  // Filter items by selected category
  const filteredItems = useMemo(() => {
    if (selectedCategory === 'ALL') {
      return inventoryWithDefinitions;
    }
    return inventoryWithDefinitions.filter(({ itemDef }) => itemDef?.category === selectedCategory);
  }, [inventoryWithDefinitions, selectedCategory]);

  // Group items by category for display
  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, typeof inventoryWithDefinitions> = {};

    filteredItems.forEach((item) => {
      if (item.itemDef) {
        const category = item.itemDef.category;
        if (!grouped[category]) {
          grouped[category] = [];
        }
        grouped[category].push(item);
      }
    });

    return grouped;
  }, [filteredItems]);

  // Get emoji for item based on category
  const getItemEmoji = (item: Item | undefined): string => {
    if (!item) return '❓';

    switch (item.category) {
      case ITEM_CATEGORIES.FOOD:
        return '🍖';
      case ITEM_CATEGORIES.DRINK:
        return '🥤';
      case ITEM_CATEGORIES.TOY:
        return '🎾';
      case ITEM_CATEGORIES.MEDICINE:
        return '💊';
      case ITEM_CATEGORIES.BANDAGE:
        return '🩹';
      case ITEM_CATEGORIES.HYGIENE:
        return '🧻';
      case ITEM_CATEGORIES.ENERGY_BOOSTER:
        return '⚡';
      case ITEM_CATEGORIES.TOOL:
        return '🔧';
      case ITEM_CATEGORIES.MATERIAL:
        return '📦';
      case ITEM_CATEGORIES.EGG:
        return '🥚';
      case ITEM_CATEGORIES.CURRENCY:
        return '🪙';
      default:
        return '📦';
    }
  };

  const handleUseItem = () => {
    if (selectedItem && getItemById(selectedItem.itemId)?.consumable) {
      onUseItem(selectedItem.itemId, 1);
      // Refresh selected item if it still exists
      const updatedItem = gameState.inventory.items.find(
        (item) => item.itemId === selectedItem.itemId,
      );
      setSelectedItem(updatedItem || null);
    }
  };

  if (!isOpen) return null;

  const selectedItemDef = selectedItem ? getItemById(selectedItem.itemId) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-t-2xl p-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Inventory</h1>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors text-3xl"
            >
              ✕
            </button>
          </div>
          <div className="mt-4 flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="text-yellow-300 text-2xl">🪙</span>
              <span className="text-xl font-semibold">
                {gameState.inventory.currency.coins} Coins
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-200">📦</span>
              <span className="text-sm">
                {gameState.inventory.items.length}/{gameState.inventory.maxSlots} Slots
              </span>
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="bg-gray-100 px-6 py-4 border-b">
          <div className="flex gap-2 overflow-x-auto">
            <CategoryButton
              label="All"
              isActive={selectedCategory === 'ALL'}
              onClick={() => setSelectedCategory('ALL')}
            />
            {Object.values(ITEM_CATEGORIES).map((category) => (
              <CategoryButton
                key={category}
                label={category}
                isActive={selectedCategory === category}
                onClick={() => setSelectedCategory(category as ItemCategory)}
              />
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Items Grid */}
          <div className="flex-1 p-6 overflow-y-auto">
            {Object.keys(itemsByCategory).length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <div className="text-6xl mb-4">📦</div>
                <p className="text-lg">No items in this category</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(itemsByCategory).map(([category, items]) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wider">
                      {category}
                    </h3>
                    <div className="grid grid-cols-8 gap-2">
                      {items.map(({ inventoryItem, itemDef }) => (
                        <ItemSlot
                          key={`${inventoryItem.itemId}-${inventoryItem.obtainedTime}`}
                          inventoryItem={inventoryItem}
                          itemDef={itemDef}
                          emoji={getItemEmoji(itemDef)}
                          isSelected={selectedItem === inventoryItem}
                          onClick={() => setSelectedItem(inventoryItem)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Item Details Panel */}
          {selectedItem && selectedItemDef && (
            <div className="w-96 border-l bg-gray-50 p-6 overflow-y-auto">
              <div className="bg-white rounded-xl p-6 shadow-md">
                {/* Item Header */}
                <div className="flex items-start gap-4 mb-4">
                  <div className="text-6xl">{getItemEmoji(selectedItemDef)}</div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900">{selectedItemDef.name}</h2>
                    <p className="text-sm text-gray-600 mt-1">Quantity: {selectedItem.quantity}</p>
                    {selectedItem.currentDurability !== undefined && (
                      <p className="text-sm text-gray-600">
                        Durability: {selectedItem.currentDurability}/
                        {(selectedItemDef as any).durability}
                      </p>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-700 mb-4">{selectedItemDef.description}</p>

                {/* Item Stats */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Category:</span>
                    <span className="font-medium">{selectedItemDef.category}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Rarity:</span>
                    <span className="font-medium">{selectedItemDef.rarity}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sell Price:</span>
                    <span className="font-medium">🪙 {selectedItemDef.sellPrice}</span>
                  </div>
                  {selectedItemDef.stackable && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Max Stack:</span>
                      <span className="font-medium">{selectedItemDef.maxStack}</span>
                    </div>
                  )}
                </div>

                {/* Item Effects */}
                {selectedItemDef.category === ITEM_CATEGORIES.FOOD && (
                  <ItemEffectsDisplay item={selectedItemDef} />
                )}
                {selectedItemDef.category === ITEM_CATEGORIES.DRINK && (
                  <ItemEffectsDisplay item={selectedItemDef} />
                )}
                {selectedItemDef.category === ITEM_CATEGORIES.TOY && (
                  <ItemEffectsDisplay item={selectedItemDef} />
                )}

                {/* Action Buttons */}
                {selectedItemDef.consumable && (
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={handleUseItem}
                      className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors font-medium"
                    >
                      Use Item
                    </button>
                    <button className="flex-1 bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors font-medium">
                      Drop
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper Components
const CategoryButton: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
      isActive ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-200'
    }`}
  >
    {label}
  </button>
);

const ItemSlot: React.FC<{
  inventoryItem: InventoryItem;
  itemDef: Item | undefined;
  emoji: string;
  isSelected: boolean;
  onClick: () => void;
}> = ({ inventoryItem, itemDef, emoji, isSelected, onClick }) => {
  const getRarityColor = (rarity: string | undefined) => {
    switch (rarity) {
      case 'LEGENDARY':
        return 'border-purple-500 bg-purple-50';
      case 'EPIC':
        return 'border-purple-400 bg-purple-50';
      case 'RARE':
        return 'border-blue-500 bg-blue-50';
      case 'UNCOMMON':
        return 'border-green-500 bg-green-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`relative aspect-square border-2 rounded-lg p-2 cursor-pointer transition-all hover:scale-105 ${
        isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
      } ${getRarityColor(itemDef?.rarity)}`}
      title={itemDef?.name}
    >
      <div className="flex items-center justify-center h-full text-3xl">{emoji}</div>
      {inventoryItem.quantity > 1 && (
        <div className="absolute bottom-1 right-1 bg-gray-800 text-white text-xs px-1.5 py-0.5 rounded-md font-bold">
          {inventoryItem.quantity}
        </div>
      )}
      {inventoryItem.currentDurability !== undefined && itemDef && (
        <div className="absolute top-1 left-1 w-full max-w-[calc(100%-8px)]">
          <div className="h-1 bg-gray-300 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{
                width: `${(inventoryItem.currentDurability / (itemDef as any).durability) * 100}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const ItemEffectsDisplay: React.FC<{ item: any }> = ({ item }) => {
  const effects = [];

  if (item.satietyRestore) effects.push(`🍖 +${item.satietyRestore} Satiety`);
  if (item.hydrationRestore) effects.push(`💧 +${item.hydrationRestore} Hydration`);
  if (item.happinessIncrease) effects.push(`😊 +${item.happinessIncrease} Happiness`);
  if (item.happinessBonus) effects.push(`😊 +${item.happinessBonus} Happiness`);
  if (item.energyBonus) effects.push(`⚡ +${item.energyBonus} Energy`);
  if (item.energyCost) effects.push(`⚡ -${item.energyCost} Energy`);
  if (item.healingAmount) effects.push(`❤️ +${item.healingAmount} Health`);

  if (effects.length === 0) return null;

  return (
    <div className="bg-blue-50 rounded-lg p-3 mb-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Effects:</h3>
      <div className="space-y-1">
        {effects.map((effect, index) => (
          <p key={index} className="text-sm text-gray-600">
            {effect}
          </p>
        ))}
      </div>
    </div>
  );
};
