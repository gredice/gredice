# Cancel planned operation or plant field

**Status**: In-review

## Overview

User can cancel planned operation or planted field to provide flexibility in farm management and prevent accidental or unwanted operations/plantings.

## Business Rules

### Operations Cancellation

- Can cancel operations with status: `new`, `planned`
- Cannot cancel operations with status: `completed`, `failed`, `canceled`
- Refund amount = operation price × 1000 (sunflower conversion rate)
- Refund reason format: `refund:operation:{operationId}`

### Plant Field Cancellation Rules

- Can cancel planted fields with status: `new`, `planned`
- Cannot cancel fields with status: `sowed`, `sprouted`, `ready`, `harvested`, `removed`
- Plant cost refund = pricePerPlant * 1000 (sunflower conversion rate)
- Refund reason format: `refund:plant:{raisedBedId}|{positionIndex}`

## User Experience

### Operation Cancellation

1. Display cancel button next to operations in admin schedule view
2. Show confirmation modal with:
   - Operation details (name, scheduled date, location)
   - Refund amount information
   - Reason input field (required)
   - Consequences warning
3. Send notification to user upon cancellation
4. Update UI to reflect cancellation

### Plant Field Cancellation UX

1. Display cancel button in raised bed field management interface
2. Show confirmation modal with:
   - Plant details (name, variety, scheduled date)
   - Field location information
   - Refund amount (if applicable)
   - Reason input field (required)
   - Warning about field reset
3. Send notification to user upon cancellation
4. Reset field to empty state

## Technical Implementation Plan

### Phase 1: Extend Operation Cancellation (EXISTING - Enhancement needed)

**Files to modify:**

- `apps/app/app/(actions)/operationActions.ts` - Already has `cancelOperationAction` ✅
- `apps/app/app/admin/schedule/CancelOperationModal.tsx` - Already exists ✅
- API routes - Already support operation cancellation ✅

**Enhancements needed:**

- Add user-facing cancellation interface (currently admin-only)
- Improve refund calculation transparency
- Add consequence warnings in UI

### Phase 2: Plant Field Cancellation (NEW FEATURE)

#### Backend Implementation

**New Events:**

```typescript
// Add to packages/storage/src/repositories/eventsRepo.ts
raisedBedFields: {
  // ... existing events
  plantCancelV1: (aggregateId: string, data: { canceledBy: string, reason: string, refundAmount?: number }) => ({
    type: "raisedBedField.plantCancel",
    version: 1,
    aggregateId,
    data
  })
}
```

**New Actions:**

```typescript
// New file: apps/app/app/(actions)/plantFieldActions.ts
export async function cancelPlantFieldAction(formData: FormData) {
  // Validate permissions
  // Check field status (only new/planned allowed)
  // Calculate refund amount
  // Create cancellation event
  // Reset field to empty state
  // Refund sunflowers
  // Send notification
  // Revalidate paths
}
```

**API Routes:**

```typescript
// Add to apps/api/app/api/[...route]/gardensRoutes.ts
.delete(
  '/:gardenId/raised-beds/:raisedBedId/fields/:positionIndex/plant',
  // Cancel planted field implementation
)
```

#### Frontend Implementation

**New Components:**

```typescript
// apps/app/app/components/CancelPlantFieldModal.tsx
interface CancelPlantFieldModalProps {
  raisedBedId: number;
  positionIndex: number;
  plant: PlantData;
  trigger: React.ReactElement;
}
```

**Component Integration:**

- `packages/game/src/hud/raisedBed/RaisedBedFieldItemPlanted.tsx` - Add cancel button
- `packages/game/src/hud/raisedBed/RaisedBedPlantPicker.tsx` - Add cancel option for new plants
- `apps/app/app/admin/raised-beds/[raisedBedId]/` - Admin interface enhancements

#### Data Flow

1. **User Initiates Cancellation**
   - Click cancel button in UI
   - Modal opens with confirmation details

2. **Validation**
   - Check user permissions
   - Validate field status allows cancellation
   - Calculate refund amount

3. **Cancellation Processing**
   - Create `plantCancel` event
   - Update field status to empty/available
   - Process sunflower refund
   - Send user notification

4. **UI Updates**
   - Close modal
   - Update field display
   - Refresh related data

### Phase 3: User Interface Integration

#### Enhanced Operation Cancellation UI

- Move cancellation capability from admin-only to user-accessible
- Add cancellation button in user's operation schedule
- Improve modal design with better consequence explanations

#### Plant Field Cancellation UI

- Add cancel action to planted field items
- Integrate with existing raised bed interface
- Provide clear status indicators

### Phase 4: Testing & Validation

#### Unit Tests

```typescript
// packages/storage/tests/plantFieldCancellation.spec.ts
describe('Plant Field Cancellation', () => {
  test('should cancel new plant field')
  test('should prevent canceling sowed plants')
  test('should calculate correct refund amount')
  test('should emit correct events')
})
```

#### Integration Tests

- Test full cancellation flow
- Verify refund processing
- Validate notification delivery
- Check UI state updates

## Database Impact

### Events Table

- New event type: `raisedBedField.plantCancel`
- Event data structure for cancellation details

### No Schema Changes Required

- Using event sourcing pattern
- Field status derived from events
- Sunflower transactions via existing events

## Security Considerations

### Authorization

- Users can only cancel their own operations/plants
- Admin users can cancel any operation/plant
- Rate limiting on cancellation actions

### Validation

- Server-side status validation
- Prevent race conditions
- Audit trail via events

## Monitoring & Analytics

### Metrics to Track

- Cancellation rates by operation type
- Refund amounts processed
- User satisfaction with cancellation process
- Most common cancellation reasons

### Alerts

- High cancellation rates (>20%)
- Failed refund processing
- Invalid cancellation attempts

## Dependencies

### External

- None

### Internal

- Existing operation cancellation system
- Sunflower transaction system
- Event sourcing infrastructure
- Notification system

## Risks & Mitigation

### Technical Risks

- **Risk**: Event ordering issues in concurrent cancellations
- **Mitigation**: Use database transactions and event versioning

- **Risk**: Incorrect refund calculations
- **Mitigation**: Comprehensive testing and audit logging

### Business Risks

- **Risk**: Users abuse cancellation system
- **Mitigation**: Rate limiting and monitoring

- **Risk**: Revenue impact from increased cancellations
- **Mitigation**: Analytics to understand cancellation patterns

## Success Criteria

### Functional

- ✅ Users can cancel planned operations
- ✅ Users can cancel new/planned plant fields  
- ✅ Refunds are processed correctly
- ✅ Notifications are sent appropriately
- ✅ UI reflects cancellation status immediately

### Non-Functional

- ⏱️ Cancellation completes within 2 seconds
- 🔒 No unauthorized cancellations possible
- 📊 <5% error rate in cancellation processing
- 🎯 >90% user satisfaction with cancellation process

## Future Enhancements

### V2 Features

- Partial refunds based on time elapsed
- Cancellation windows (e.g., can't cancel within 24h of scheduled time)
- Bulk cancellation operations
- Automated cancellation for system maintenance

### Advanced Features

- Machine learning predictions for cancellation likelihood
- Dynamic refund calculations based on market conditions
- Integration with third-party scheduling systems
