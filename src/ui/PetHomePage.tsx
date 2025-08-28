import React, { useState } from 'react';
import type { GameState } from '../models';
import { STATUS_TYPES } from '../models/constants';
import { InventoryScreen } from './InventoryScreen';

interface PetHomePageProps {
  gameState: GameState;
  onUserAction: (action: string, data?: any) => void;
}

export const PetHomePage: React.FC<PetHomePageProps> = ({ gameState, onUserAction }) => {
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  if (!gameState.pet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-700">No pet found</h1>
          <p className="text-gray-500">Please select a starter pet first.</p>
        </div>
      </div>
    );
  }

  const { pet } = gameState;
  const careValues = pet.careValues || { satiety: 100, hydration: 100, happiness: 100 };

  const handleFeed = () => {
    onUserAction('FEED_PET');
  };

  const handleDrink = () => {
    onUserAction('GIVE_DRINK');
  };

  const handlePlay = () => {
    onUserAction('PLAY_WITH_PET');
  };

  const handleClean = () => {
    onUserAction('CLEAN_POOP');
  };

  const handleSleep = () => {
    if (pet.status.primary === STATUS_TYPES.SLEEPING) {
      onUserAction('WAKE_PET');
    } else {
      onUserAction('PET_SLEEP');
    }
  };

  // Get pet emoji based on ID (temporary until we have sprites)
  const getPetEmoji = () => {
    switch (pet.species) {
      case 'starter_fire':
        return '🔥';
      case 'starter_water':
        return '💧';
      case 'starter_grass':
        return '🌿';
      default:
        return '🐾';
    }
  };

  const getStateMessage = () => {
    switch (pet.status.primary) {
      case STATUS_TYPES.SLEEPING:
        return 'Sleeping...';
      case STATUS_TYPES.TRAVELING:
        return 'Traveling...';
      case STATUS_TYPES.EXPLORING:
        return 'Busy with activity...';
      case STATUS_TYPES.IN_BATTLE:
        return 'In battle!';
      case STATUS_TYPES.DEAD:
        return 'Needs revival...';
      default:
        return 'Ready for adventure!';
    }
  };

  const handleUseItem = (itemId: string, quantity: number) => {
    onUserAction('USE_ITEM', { itemId, quantity });
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-green-100 to-yellow-100">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-800 mb-1">{pet.name || 'Your Pet'}</h1>
                <p className="text-gray-600">
                  Level {pet.stage} • {pet.species}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Coins</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {gameState.inventory.currency.coins}
                </p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Pet Display */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="text-center mb-6">
                <div className="text-9xl mb-4 animate-bounce">{getPetEmoji()}</div>
                <p className="text-lg text-gray-700 font-medium">{getStateMessage()}</p>
              </div>

              {/* Poop Display */}
              {pet.poopCount > 0 && (
                <div className="text-center mb-4">
                  <div className="inline-flex gap-2">
                    {Array.from({ length: Math.min(pet.poopCount, 5) }).map((_, i) => (
                      <span key={i} className="text-2xl">
                        💩
                      </span>
                    ))}
                    {pet.poopCount > 5 && (
                      <span className="text-gray-600">+{pet.poopCount - 5}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Status Indicators */}
              {(pet.sicknesses?.length > 0 || pet.injuries?.length > 0) && (
                <div className="flex justify-center gap-4 mt-4">
                  {pet.sicknesses?.length > 0 && (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                      🤧 Sick
                    </span>
                  )}
                  {pet.injuries?.length > 0 && (
                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                      🩹 Injured
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Stats & Actions */}
            <div className="space-y-6">
              {/* Care Values */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Care Status</h2>
                <div className="space-y-3">
                  <CareBar
                    label="Satiety"
                    value={careValues.satiety}
                    max={100}
                    color="bg-orange-500"
                    icon="🍖"
                  />
                  <CareBar
                    label="Hydration"
                    value={careValues.hydration}
                    max={100}
                    color="bg-blue-500"
                    icon="💧"
                  />
                  <CareBar
                    label="Happiness"
                    value={careValues.happiness}
                    max={100}
                    color="bg-pink-500"
                    icon="😊"
                  />
                  <CareBar
                    label="Energy"
                    value={pet.energy}
                    max={pet.maxEnergy}
                    color="bg-green-500"
                    icon="⚡"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Actions</h2>
                <div className="grid grid-cols-2 gap-3">
                  <ActionButton
                    onClick={handleFeed}
                    icon="🍖"
                    label="Feed"
                    disabled={pet.status.primary !== STATUS_TYPES.IDLE}
                  />
                  <ActionButton
                    onClick={handleDrink}
                    icon="💧"
                    label="Drink"
                    disabled={pet.status.primary !== STATUS_TYPES.IDLE}
                  />
                  <ActionButton
                    onClick={handlePlay}
                    icon="🎾"
                    label="Play"
                    disabled={pet.status.primary !== STATUS_TYPES.IDLE}
                  />
                  <ActionButton
                    onClick={handleClean}
                    icon="🧹"
                    label="Clean"
                    disabled={pet.poopCount === 0}
                  />
                  <ActionButton
                    onClick={handleSleep}
                    icon={pet.status.primary === STATUS_TYPES.SLEEPING ? '⏰' : '😴'}
                    label={pet.status.primary === STATUS_TYPES.SLEEPING ? 'Wake' : 'Sleep'}
                    disabled={
                      pet.status.primary !== STATUS_TYPES.IDLE &&
                      pet.status.primary !== STATUS_TYPES.SLEEPING
                    }
                  />
                </div>
              </div>

              {/* Quick Nav */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Navigation</h2>
                <div className="grid grid-cols-3 gap-3">
                  <NavButton onClick={() => setIsInventoryOpen(true)} icon="🎒" label="Inventory" />
                  <NavButton onClick={() => console.log('Shop')} icon="🛍️" label="Shop" />
                  <NavButton onClick={() => console.log('Travel')} icon="🗺️" label="Travel" />
                  <NavButton
                    onClick={() => console.log('Activities')}
                    icon="🎯"
                    label="Activities"
                  />
                  <NavButton onClick={() => console.log('Training')} icon="💪" label="Training" />
                  <NavButton onClick={() => console.log('Events')} icon="🎉" label="Events" />
                </div>
              </div>
            </div>
          </div>

          {/* Battle Stats (hidden by default, shown when relevant) */}
          {pet.stats && (
            <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Battle Stats</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatDisplay label="Health" value={pet.stats.health} max={pet.stats.maxHealth} />
                <StatDisplay label="Attack" value={pet.stats.attack} />
                <StatDisplay label="Defense" value={pet.stats.defense} />
                <StatDisplay label="Speed" value={pet.stats.speed} />
                <StatDisplay label="Action" value={pet.stats.action} max={pet.stats.maxAction} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inventory Screen */}
      <InventoryScreen
        gameState={gameState}
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
        onUseItem={handleUseItem}
      />
    </>
  );
};

// Helper Components
const CareBar: React.FC<{
  label: string;
  value: number;
  max: number;
  color: string;
  icon: string;
}> = ({ label, value, max, color, icon }) => {
  const percentage = (value / max) * 100;
  const isLow = percentage < 30;

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">
          {icon} {label}
        </span>
        <span className={`text-sm ${isLow ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
          {value}/{max}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300 ${isLow ? 'animate-pulse' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const ActionButton: React.FC<{
  onClick: () => void;
  icon: string;
  label: string;
  disabled?: boolean;
}> = ({ onClick, icon, label, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      py-3 px-4 rounded-lg font-medium transition-all
      ${
        disabled
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-blue-500 text-white hover:bg-blue-600 hover:scale-105 shadow-md'
      }
    `}
  >
    <span className="text-xl mr-2">{icon}</span>
    {label}
  </button>
);

const NavButton: React.FC<{
  onClick: () => void;
  icon: string;
  label: string;
}> = ({ onClick, icon, label }) => (
  <button
    onClick={onClick}
    className="py-3 px-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-center transition-all hover:scale-105"
  >
    <div className="text-2xl mb-1">{icon}</div>
    <div className="text-xs text-gray-700">{label}</div>
  </button>
);

const StatDisplay: React.FC<{
  label: string;
  value: number;
  max?: number;
}> = ({ label, value, max }) => (
  <div className="text-center">
    <p className="text-sm text-gray-600 mb-1">{label}</p>
    <p className="text-xl font-bold text-gray-800">
      {value}
      {max ? `/${max}` : ''}
    </p>
  </div>
);
