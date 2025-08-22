# Raised bed field operations grouping

**Status**: In-review

## Overview

Raised bed field operations should be grouped by category to provide better organization and user experience in the game interface. This feature extends the existing www app radnje page grouping pattern to raised bed field operations.

Category is extracted from the operation attributes (`operation.attributes.stage.information.name`), and each operation is assigned to a single category for grouping and filtering purposes.

## Current Implementation Analysis

### Existing Grouping in WWW App

The www app's radnje page (`apps/www/app/radnje/page.tsx`) already implements operation grouping by stage:

```typescript
const stagesLabels = [...new Set(operationsData?.map(op => op.attributes.stage?.information?.label) || [])];
```

### Current Game Interface Operations

Currently, operations in the game interface are filtered but not grouped:

1. **RaisedBedWatering.tsx** - Filters by watering stage: `operation.attributes.stage.information?.name === 'watering'`
2. **RaisedBedFieldOperationsTab.tsx** - Filters by plant application: `operation.attributes.application === 'plant'`

## Business Requirements

### Operation Categories

Based on existing data structure and plant lifecycle, operations are categorized by stage:

| Category ID | Category Label | Croatian Label | Operations Include |
|-------------|---------------|----------------|-------------------|
| `sowing` | Sowing | Sijanje | Seed planting, direct sowing |
| `soilPreparation` | Soil Preparation | Priprema tla | Tilling, composting, fertilizing |
| `planting` | Planting | Sadnja | Transplanting seedlings |
| `growth` | Growth | Rast | Growth monitoring, pruning |
| `maintenance` | Maintenance | Održavanje | General care, pest control |
| `watering` | Watering | Zalijevanje | Irrigation, moisture management |
| `flowering` | Flowering | Cvjetanje | Flower care, pollination |
| `harvest` | Harvest | Berba | Fruit/vegetable collection |
| `storage` | Storage | Skladištenje | Post-harvest processing |

### Grouping Rules

1. **Primary Grouping**: By `operation.attributes.stage.information.name`
2. **Secondary Filtering**: By application (`plant`, `raisedBed1m`, etc.)
3. **Display Order**: Sort groups by lifecycle progression
4. **Empty Groups**: Hide categories with no available operations

## User Experience Requirements

### Raised Bed Field Operations Tab Enhancement

**Current State**: Flat list of all plant operations  
**Desired State**: Grouped operations by category with expandable sections

**User Flow**:

1. User opens field operations tab
2. Operations are displayed in categorized groups
3. Each category shows operation count badge
4. Categories are collapsible/expandable
5. User can filter specific categories if needed

### Watering Modal Enhancement

**Current State**: Filtered list of watering operations  
**Desired State**: Keep current behavior (watering-specific operations only)

**Note**: Watering modal should remain focused on watering operations only.

## Technical Implementation Plan

### Phase 1: Create Operation Categorization Utilities

#### New Utility Functions

**File**: `packages/game/src/utils/operationCategorization.ts`

```typescript
import { OperationData } from '@gredice/client';

export interface OperationCategory {
  id: string;
  label: string;
  croatianLabel: string;
  order: number;
  icon?: string;
}

export const OPERATION_CATEGORIES: OperationCategory[] = [
  { id: 'soilPreparation', label: 'Soil Preparation', croatianLabel: 'Priprema tla', order: 1 },
  { id: 'sowing', label: 'Sowing', croatianLabel: 'Sijanje', order: 2 },
  { id: 'planting', label: 'Planting', croatianLabel: 'Sadnja', order: 3 },
  { id: 'growth', label: 'Growth', croatianLabel: 'Rast', order: 4 },
  { id: 'watering', label: 'Watering', croatianLabel: 'Zalijevanje', order: 5 },
  { id: 'maintenance', label: 'Maintenance', croatianLabel: 'Održavanje', order: 6 },
  { id: 'flowering', label: 'Flowering', croatianLabel: 'Cvjetanje', order: 7 },
  { id: 'harvest', label: 'Harvest', croatianLabel: 'Berba', order: 8 },
  { id: 'storage', label: 'Storage', croatianLabel: 'Skladištenje', order: 9 },
];

export function categorizeOperations(operations: OperationData[]): Record<string, OperationData[]> {
  const categorized: Record<string, OperationData[]> = {};
  
  operations.forEach(operation => {
    const categoryId = operation.attributes.stage.information?.name || 'other';
    if (!categorized[categoryId]) {
      categorized[categoryId] = [];
    }
    categorized[categoryId].push(operation);
  });
  
  return categorized;
}

export function getOperationCategory(categoryId: string): OperationCategory | undefined {
  return OPERATION_CATEGORIES.find(cat => cat.id === categoryId);
}

export function getSortedCategories(categorizedOperations: Record<string, OperationData[]>): OperationCategory[] {
  return OPERATION_CATEGORIES
    .filter(cat => categorizedOperations[cat.id]?.length > 0)
    .sort((a, b) => a.order - b.order);
}
```

REVIEW: TODO: We shouldn't use hardcoded OPERATION_CATEGORIES

### Phase 2: Create Grouped Operations List Component

#### New Component: OperationsListGrouped

**File**: `packages/game/src/hud/raisedBed/shared/OperationsListGrouped.tsx`

```typescript
import { useState } from 'react';
import { OperationData } from '@gredice/client';
import { Accordion, AccordionItem } from '@signalco/ui-primitives/Accordion';
import { Typography } from '@signalco/ui-primitives/Typography';
import { Badge } from '@signalco/ui-primitives/Badge';
import { OperationsListItem } from './OperationsList';
import { categorizeOperations, getSortedCategories, getOperationCategory } from '../../../utils/operationCategorization';

interface OperationsListGroupedProps {
  operations: OperationData[];
  gardenId: number;
  raisedBedId?: number;
  positionIndex?: number;
  plantSortId?: number;
  filterFunc: (operation: OperationData) => boolean;
  showCategoryFilter?: boolean;
  defaultOpenCategories?: string[];
}

export function OperationsListGrouped({
  operations,
  gardenId,
  raisedBedId,
  positionIndex,
  plantSortId,
  filterFunc,
  showCategoryFilter = false,
  defaultOpenCategories = []
}: OperationsListGroupedProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(defaultOpenCategories)
  );
  
  const filteredOperations = operations?.filter(filterFunc) || [];
  const categorizedOperations = categorizeOperations(filteredOperations);
  const sortedCategories = getSortedCategories(categorizedOperations);

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  if (sortedCategories.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Nema dostupnih radnji
      </div>
    );
  }

  return (
    <Accordion type="multiple" className="w-full">
      {sortedCategories.map(category => {
        const categoryOperations = categorizedOperations[category.id];
        const isExpanded = expandedCategories.has(category.id);
        
        return (
          <AccordionItem key={category.id} value={category.id}>
            <AccordionTrigger 
              onClick={() => toggleCategory(category.id)}
              className="flex justify-between items-center p-3 hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <Typography level="h6">{category.croatianLabel}</Typography>
                <Badge variant="secondary">{categoryOperations.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-1">
                {categoryOperations.map(operation => (
                  <OperationsListItem
                    key={operation.id}
                    operation={operation}
                    gardenId={gardenId}
                    raisedBedId={raisedBedId}
                    positionIndex={positionIndex}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
```

### Phase 3: Update Existing Components

#### Update RaisedBedFieldOperationsTab

**File**: `packages/game/src/hud/raisedBed/RaisedBedFieldOperationsTab.tsx`

```typescript
import { OperationsListGrouped } from "./shared/OperationsListGrouped";

export function RaisedBedFieldOperationsTab({ 
  gardenId, 
  raisedBedId, 
  positionIndex, 
  plantSortId 
}: { 
  gardenId: number; 
  raisedBedId: number; 
  positionIndex: number; 
  plantSortId?: number 
}) {
  return (
    <OperationsListGrouped
      gardenId={gardenId}
      raisedBedId={raisedBedId}
      positionIndex={positionIndex}
      plantSortId={plantSortId}
      filterFunc={(operation) => operation.attributes.application === 'plant'}
      defaultOpenCategories={['watering', 'maintenance']} // Most common categories
      showCategoryFilter={true}
    />
  );
}
```

#### Keep RaisedBedWatering Unchanged

The `RaisedBedWatering` component should remain unchanged as it serves a specific purpose (watering-only operations) and the grouping would not add value in this context.

### Phase 4: Enhanced UX Features (Optional)

#### Category Filter Toggle

**File**: `packages/game/src/hud/raisedBed/shared/CategoryFilter.tsx`

```typescript
interface CategoryFilterProps {
  categories: OperationCategory[];
  selectedCategories: Set<string>;
  onCategoriesChange: (categories: Set<string>) => void;
}

export function CategoryFilter({
  categories,
  selectedCategories,
  onCategoriesChange
}: CategoryFilterProps) {
  // Implementation for category filtering UI
  // Chip-based filter with multi-select
}
```

#### Category Icons

Add visual icons for each category:

- 🌱 Sowing
- 🚜 Soil Preparation  
- 🌿 Planting
- 📈 Growth
- 💧 Watering
- 🔧 Maintenance
- 🌸 Flowering
- 🍅 Harvest
- 📦 Storage

## Database Impact

**No database changes required** - This feature uses existing operation data and attributes.

### Technical Metrics

- ⏱️ **Performance**: No degradation in component render time
- 🔒 **Reliability**: <1% error rate in categorization
- 📱 **Compatibility**: Works on all supported devices/browsers

## Future Enhancements

### Phase 2 Features

1. **Smart Categorization**: AI-suggested operation groupings
2. **Custom Categories**: User-defined operation groups
3. **Category Search**: Search within specific categories
4. **Recommendations**: "Next suggested operation" based on plant lifecycle

### Integration Opportunities

1. **Calendar Integration**: Show operations by season/timing
2. **Plant Lifecycle**: Visual progress indicators per category
3. **Analytics**: Operation success rates by category
4. **Notifications**: Category-based operation reminders

## Dependencies

### External Dependencies

- None

### Internal Dependencies

- Existing operation data structure
- OperationsList component
- Game UI component library
- Feature flag system

## Risks & Mitigation

### Technical Risks

- **Risk**: Component complexity increases
- **Mitigation**: Modular design with clear separation of concerns

- **Risk**: Performance impact on operation filtering
- **Mitigation**: Memoization and lazy loading strategies

### User Experience Risks

- **Risk**: Important operations hidden in collapsed categories
- **Mitigation**: Smart defaults for expanded categories

## Acceptance Criteria

### Functional Requirements

- ✅ Operations are grouped by stage/category
- ✅ Categories can be expanded/collapsed
- ✅ Operation count badges display correctly
- ✅ Filtering works within categories
- ✅ Feature flag controls grouping behavior
- ✅ Existing watering modal remains unchanged

### Non-Functional Requirements

- ⏱️ Component renders within 100ms
- 📱 Works on mobile and desktop
- ♿ Accessible keyboard navigation
- 🌐 Supports Croatian localization
- 🔄 Graceful degradation if categorization fails
