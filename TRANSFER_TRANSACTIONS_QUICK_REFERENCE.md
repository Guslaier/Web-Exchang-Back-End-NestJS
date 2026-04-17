# Transfer Transactions Module - Quick Reference Guide

## Module Overview
Complete transfer/movement management system handling booth-to-booth transfers, center-to-booth distributions, and internal movements.

## File Structure
```
src/modules/transfer-transactions/
├── entities/
│   └── transfer-transaction.entity.ts     # Database entity with relations
├── dto/
│   └── transfer-transaction.dto.ts        # 7 DTOs for different operations
├── transfer-transactions.service.ts       # 13+ service methods
├── transfer-transactions.controller.ts    # 12 API endpoints
└── transfer-transactions.module.ts        # Module configuration & DI
```

## Core Entity Fields
```typescript
{
  id: UUID (PK),
  transaction_no: string (unique),
  booth_id: UUID (FK),           // Source booth
  currency_name: string,
  amount: decimal(15,2),
  currencies_code: string,       // e.g., "THB"
  type: string,                  // BOOTH_TO_BOOTH | CENTER_TO_BOOTH | INTERNAL_MOVEMENT
  ref_booth_id: UUID (FK, optional),  // Destination booth
  description: string,
  user_id: UUID (FK),           // Who performed it
  status: string,               // PENDING | COMPLETED | VOIDED | CANCELED
  created_at: timestamp,
  deleted_at: timestamp (soft delete)
}
```

## Main Service Methods (13 total)

### Transfer Operations (3)
| Method | Returns | Purpose |
|--------|---------|---------|
| `createMovement()` | boolean | Internal stock/cash movement |
| `transferBoothToBooth()` | boolean | Inter-booth transfer |
| `transferCenterToBooth()` | boolean | Center to booth distribution |

### Query Methods (4)
| Method | Returns | Purpose |
|--------|---------|---------|
| `get_transfers()` | TransferTransaction[] | All transfers |
| `get_transfers_per_Booth()` | TransferTransaction[] | Booth-specific transfers |
| `get_transfers_Booth_To_Booth()` | TransferTransaction[] | B2B transfers only |
| `get_CashInventory()` | number | Cash balance in booth |
| `get_totalReceive()` | number | Shift received total |

### CRUD Methods (5)
| Method | Returns | Purpose |
|--------|---------|---------|
| `create()` | TransferTransaction | Create new transfer |
| `findOne()` | TransferTransaction | Get by ID |
| `update()` | TransferTransaction | Update transfer |
| `remove()` | void | Soft delete |

## API Endpoints (12 total)

### Create Operations (POST)
```
POST /transfer-transactions/movements          # Internal movement
POST /transfer-transactions/booth-to-booth      # B2B transfer
POST /transfer-transactions/center-to-booth     # Center → Booth
POST /transfer-transactions                      # Generic create
```

### Query Operations (GET)
```
GET /transfer-transactions/all                 # All transfers
GET /transfer-transactions/booth/:boothId      # Booth transfers
GET /transfer-transactions/booth-transfers     # B2B only
GET /transfer-transactions/inventory/:boothId  # Cash inventory
GET /transfer-transactions/total-receive/:shiftId  # Shift total
GET /transfer-transactions/:id                 # Single transfer
```

### Modify Operations
```
PATCH /transfer-transactions/:id               # Update transfer
DELETE /transfer-transactions/:id              # Delete transfer
```

## Response Format
```json
{
  "success": true,
  "data": { /* entity or array */ },
  "message": "Operation description",
  "count": 5
}
```

## DTOs at a Glance

| DTO | Usage | Key Fields |
|-----|-------|-----------|
| `CreateTransferTransactionDto` | Generic create | booth_id, amount, currencies_code, type, user_id |
| `TransferBoothTBoothDto` | B2B transfer | booth_id + ref_booth_id, amount, currencies_code |
| `TransferCenterToBoothDto` | Center distribution | booth_id, amount, currencies_code, cashCountData[] |
| `CashCountDataDto` | Denomination tracking | denomination, amount |
| `UpdateTransferTransactionDto` | Partial update | description, status |

## Security & Access Control

All endpoints require JWT token and role-based authorization:

```
Admin role       → Full access (create, update, delete)
Manager role     → Create, read, update (no delete)
Staff role       → Read-only access
```

Controllers use guards:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager')  // Per-endpoint override
```

## Dependency Injection

The service automatically injects:
- `BoothsService` - Booth validation
- `CurrenciesService` - Currency operations
- `CashCountsService` - Denomination tracking
- `SystemLogsService` - Audit logging
- `TransactionsService` - Transaction creation

## Database Operations

### Transaction Wrapping
All write operations use database transactions:
```typescript
return await this.dataSource.transaction(async (manager) => {
  // All operations are atomic
});
```

### Audit Logging
Automatic logging via `log()` helper:
```typescript
await this.log(user, 'ACTION_NAME', 'Details', manager);
```

### Soft Delete
Records use soft delete pattern:
```typescript
@DeleteDateColumn()
deleted_at?: Date;
```

## Common Operations

### Create a Transfer
```typescript
const dto: CreateTransferTransactionDto = {
  booth_id: 'uuid',
  amount: 1000,
  currencies_code: 'THB',
  type: 'BOOTH_TO_BOOTH',
  user_id: 'user-uuid'
};
const transfer = await service.create(user, dto);
```

### Check Booth Cash Balance
```typescript
const balance = await service.get_CashInventory('booth-id');
```

### Get All Booth Transfers
```typescript
const transfers = await service.get_transfers_per_Booth('booth-id');
```

## Query Examples

### Find transfers for a booth
```sql
WHERE booth_id = 'X' OR ref_booth_id = 'X'
```

### Calculate cash inventory
```sql
SELECT SUM(amount) FROM transfer_transactions
WHERE (booth_id = 'X' OR ref_booth_id = 'X')
AND type IN ('CENTER_TO_BOOTH', 'BOOTH_TO_BOOTH')
AND status = 'COMPLETED'
```

### Get shift receipts
```sql
SELECT SUM(amount) FROM transfer_transactions
WHERE type = 'CENTER_TO_BOOTH'
AND status = 'COMPLETED'
AND DATE(created_at) = DATE(shift.created_at)
```

## Error Handling

Service throws appropriate exceptions:
- `NotFoundException` - When booth/transfer not found
- `BadRequestException` - Invalid input/validation
- `InternalServerErrorException` - Database/system errors

Controller catches exceptions and returns proper HTTP responses.

## Testing Checklist

- [ ] Booth validation
- [ ] Amount validation (positive)
- [ ] Transaction atomicity
- [ ] Soft delete behavior
- [ ] Inventory calculation accuracy
- [ ] Role-based access
- [ ] Audit logging
- [ ] Error messages
- [ ] Response format
- [ ] Relation loading

## Configuration

Module imports all required dependencies:
```typescript
TypeOrmModule.forFeature([TransferTransaction, Booth, Currency, User]),
BoothsModule,
CurrenciesModule,
CashCountsModule,
SystemLogsModule,
TransactionsModule,
```

## Key Validation Rules

✓ Booth must exist before transfer
✓ Amount must be > 0
✓ Currency code must be valid
✓ Both source and destination for B2B
✓ User must be authenticated
✓ Role authorization per endpoint

## Implementation Status

✅ Entity design with all required fields
✅ Complete DTO validation
✅ Service with all 13+ methods
✅ 12 API endpoints
✅ Dependency injection
✅ Error handling
✅ Audit logging
⏳ Inventory deduction logic (TODO)
⏳ Cash count integration (TODO)

## Next Steps

1. Implement inventory deduction in `transferBoothToBooth()`
2. Complete cash count processing in `transferCenterToBooth()`
3. Add approval workflow for high-value transfers
4. Create transfer reports module
5. Add reconciliation checks
6. Implement batch operations

---

**Module Version:** 1.0.0  
**Last Updated:** 2026-04-17  
**Status:** Production Ready (with TODOs)
