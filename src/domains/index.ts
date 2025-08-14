// Domain layer exports - Core game domains
// Each domain owns specific data and provides methods to work with that data

// Pet Domain (to be implemented)
// export * from './pet';

// Player Domain (to be implemented)
// export * from './player';

// World Domain (to be implemented)  
// export * from './world';

// Item Domain (to be implemented)
// export * from './item';

// Domain utilities and validators
export const isDomainEntity = (obj: unknown, requiredFields: string[]): boolean => {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  
  return requiredFields.every(field => field in obj);
};

// Domain-specific type guards (will be moved to respective domain folders)
export const isPet = (obj: unknown): obj is import('../core/types').Pet => {
  return isDomainEntity(obj, ['id', 'species', 'name', 'stats']);
};

export const isPlayer = (obj: unknown): obj is import('../core/types').Player => {
  return isDomainEntity(obj, ['id', 'name', 'inventory', 'currencies']);
};