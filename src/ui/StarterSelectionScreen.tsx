import React, { useState, useEffect } from 'react';
import type { GameState } from '../models';
import type { Species } from '../models/Species';
import { getStarterSpecies } from '../data/species';
import { GROWTH_STAGES } from '../models/constants';

interface StarterSelectionScreenProps {
  onSelectStarter: (species: Species) => void;
  gameState: GameState | undefined;
}

export const StarterSelectionScreen: React.FC<StarterSelectionScreenProps> = ({
  onSelectStarter,
  gameState,
}) => {
  const [selectedSpecies, setSelectedSpecies] = useState<Species | undefined>(undefined);
  const [starters, setStarters] = useState<Species[]>([]);

  useEffect(() => {
    // Get the starter species using the helper function
    const starterSpecies = getStarterSpecies();
    setStarters(starterSpecies);
  }, []);

  const handleConfirmSelection = () => {
    if (selectedSpecies) {
      console.log(
        '[StarterSelection] Confirming selection:',
        selectedSpecies.id,
        selectedSpecies.name,
      );
      onSelectStarter(selectedSpecies);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-300 via-blue-300 to-purple-300 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white drop-shadow-lg mb-4">
            Choose Your First Pet!
          </h1>
          <p className="text-xl text-white/90 drop-shadow">
            Select one of these adorable creatures to begin your adventure
          </p>
        </div>

        {/* Starter Options */}
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {starters.map((species) => (
            <div
              key={species.id}
              onClick={() => setSelectedSpecies(species)}
              className={`
                bg-white rounded-2xl shadow-xl p-6 cursor-pointer transition-all
                hover:scale-105 hover:shadow-2xl
                ${selectedSpecies?.id === species.id ? 'ring-4 ring-purple-500 ring-offset-4' : ''}
              `}
            >
              {/* Pet Image Placeholder */}
              <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl mb-4 flex items-center justify-center">
                <div className="text-6xl">
                  {species.id === 'starter_fire'
                    ? '🔥'
                    : species.id === 'starter_water'
                      ? '💧'
                      : species.id === 'starter_grass'
                        ? '🌿'
                        : '🥚'}
                </div>
              </div>

              {/* Species Info */}
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{species.name}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Habitat:</span>
                  <span className="font-semibold capitalize">{species.traits.habitat}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Rarity:</span>
                  <span className="font-semibold">{species.rarity}</span>
                </div>
              </div>

              {/* Description */}
              <p className="mt-4 text-gray-600 text-sm">{species.description}</p>

              {/* Base Stats */}
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Hatchling Stats</h4>
                <div className="space-y-1">
                  <StatBar
                    label="HP"
                    value={species.baseStats[GROWTH_STAGES.HATCHLING].health}
                    max={50}
                    color="bg-red-500"
                  />
                  <StatBar
                    label="ATK"
                    value={species.baseStats[GROWTH_STAGES.HATCHLING].attack}
                    max={20}
                    color="bg-orange-500"
                  />
                  <StatBar
                    label="DEF"
                    value={species.baseStats[GROWTH_STAGES.HATCHLING].defense}
                    max={20}
                    color="bg-blue-500"
                  />
                  <StatBar
                    label="SPD"
                    value={species.baseStats[GROWTH_STAGES.HATCHLING].speed}
                    max={20}
                    color="bg-green-500"
                  />
                </div>
              </div>

              {selectedSpecies?.id === species.id && (
                <div className="mt-4 text-center">
                  <span className="text-purple-600 font-bold">✓ Selected</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Confirm Button */}
        <div className="text-center">
          <button
            onClick={handleConfirmSelection}
            disabled={!selectedSpecies}
            className={`
              px-12 py-4 rounded-full text-xl font-bold shadow-lg transition-all
              ${
                selectedSpecies
                  ? 'bg-purple-500 text-white hover:bg-purple-600 hover:scale-105 cursor-pointer'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {selectedSpecies ? `Choose ${selectedSpecies.name}!` : 'Select a Pet'}
          </button>
        </div>

        {/* Eggs Section (if player has any) */}
        {gameState?.collections?.eggs && gameState.collections.eggs.length > 0 && (
          <div className="mt-12 bg-white/80 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Your Eggs</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {gameState.collections.eggs.map((egg, index) => (
                <div key={egg.id || index} className="bg-gray-100 rounded-lg p-4 text-center">
                  <div className="text-4xl mb-2">🥚</div>
                  <p className="text-sm text-gray-600">{egg.eggType || 'Unknown'} Egg</p>
                  <p className="text-xs text-gray-500">
                    {egg.isIncubating ? `Hatching...` : 'Ready to incubate'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper component for stat bars
const StatBar: React.FC<{
  label: string;
  value: number;
  max: number;
  color: string;
}> = ({ label, value, max, color }) => {
  const percentage = (value / max) * 100;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-600 w-8">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 w-8 text-right">{value}</span>
    </div>
  );
};
