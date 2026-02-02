# Config Surface Map: xpbdDamping Split (STEP 1/5)

**Purpose**: Document all config ownership surfaces before adding `xpbdDamping` field.

## Canonical Config Type

**File**: `src/physics/types.ts`  
**Symbol**: `ForceConfig` (interface)  
**Lines**: 112-261  
**Role**: Type definition for all physics config fields

## Default Config Object

**File**: `src/physics/config.ts`  
**Symbol**: `DEFAULT_PHYSICS_CONFIG`  
**Line**: 3  
**Type**: `ForceConfig`  
**Role**: Provides default values for all config fields

## Config Merge Function

**File**: `src/physics/engine/engineTopology.ts`  
**Symbol**: `updateEngineConfig`  
**Line**: 161  
**Signature**: `(engine: PhysicsEngineTopologyContext, newConfig: Partial<ForceConfig>) => void`  
**Role**: Merges partial config updates into engine.config

## Config Constructor Merge

**File**: `src/physics/engine.ts`  
**Symbol**: `PhysicsEngine.constructor`  
**Line**: 254-256  
**Code**: `this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };`  
**Role**: Initial config merge on engine creation

## Config Update Method

**File**: `src/physics/engine.ts`  
**Symbol**: `PhysicsEngine.updateConfig`  
**Line**: 347-349  
**Signature**: `(newConfig: Partial<ForceConfig>) => void`  
**Role**: Public API for runtime config updates (delegates to engineTopology.updateEngineConfig)

## Sanitize/Allowlist/Schema

**Status**: NOT FOUND  
**Search Results**: No sanitize, allowlist, or schema (zod/valibot) files found in src/

**Implication**: Config fields are NOT stripped or validated. Any field in `Partial<ForceConfig>` will survive merge.

## Serialization/Persistence

**Status**: NOT FOUND  
**Search Results**: No explicit serialization/persistence layer found in physics module.

**Implication**: Config persistence (if any) is handled externally. Physics engine only handles in-memory config.

## Debug/UI Config Adapter

**File**: `src/physics/engine/engineTickHud.ts`  
**Symbol**: HUD snapshot creation (various lines)  
**Line**: 248 (example: `repulsionMaxForceConfig: engine.config.repulsionMaxForce`)  
**Role**: Reads config values for HUD display (not a full adapter, just selective reads)

## Summary

**Config surfaces that MUST be updated**:
1. ✅ `ForceConfig` interface (types.ts:112)
2. ⚠️ `DEFAULT_PHYSICS_CONFIG` (config.ts:3) - NO default value (leave absent)
3. ✅ Constructor merge (engine.ts:255) - Spread operator handles new fields automatically
4. ✅ `updateEngineConfig` (engineTopology.ts:161) - Spread operator handles new fields automatically

**No sanitize/schema/persistence** - field will survive automatically through spread operators.

**Dev-only dump location**: Can add to engineTickHud.ts or console log in engine.ts constructor.
