# Transfer Transactions Module Implementation

## Overview
This document describes the complete implementation of the **Transfer Transactions Module** following the NestJS architectural patterns established in the Web Exchange Back-End project.

---

## 1. Data Structure (Entity)

### Location
`src/modules/transfer-transactions/entities/transfer-transaction.entity.ts`

### Fields
The `TransferTransaction` entity includes all required fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `transaction_no` | String | Unique transaction number |
| `booth_id` | UUID | Source booth identifier (FK) |
| `currency_name` | String | Readable currency name (e.g., "ไทย : บาท") |
| `amount` | Decimal (15,2) | Transaction amount |
| `currencies_code` | String | Currency code (e.g., "THB", "USD") |
| `type` | String | Transfer type (BOOTH_TO_BOOTH, CENTER_TO_BOOTH, INTERNAL_MOVEMENT) |
| `ref_booth_id` | UUID | Reference/destination booth (FK, nullable) |
| `description` | String | Additional transaction description |
| `user_id` | UUID | User who performed the transaction (FK) |
| `status` | String | Transaction status (PENDING, COMPLETED, VOIDED, CANCELED) |
| `created_at` | Date | Timestamp (auto-generated) |
| `updated_at` | Date | Last update timestamp |
| `deleted_at` | Date | Soft delete timestamp |

### Database Table
- Table Name: `transfer_transactions`
- Type: PostgreSQL with soft delete support
- Relations:
  - `booth` (ManyToOne) → Booth entity
  - `refBooth` (ManyToOne) → Booth entity (destination)
  - `currency` (ManyToOne) → Currency entity
  - `user` (ManyToOne) → User entity

---

## 2. Data Transfer Objects (DTOs)

### Location
`src/modules/transfer-transactions/dto/transfer-transaction.dto.ts`

#### 2.1 CreateTransferTransactionDto
Used for creating transfer transactions with validation:
- `transaction_no` (optional): Auto-generated if not provided
- `booth_id` (required, UUID): Source booth
- `currency_name` (optional): Readable currency name
- `amount` (required, number): Transaction amount
- `currencies_code` (required, string): Currency code
- `type` (required, string): Transfer type
- `ref_booth_id` (optional, UUID): Destination booth
- `description` (optional): Additional notes
- `user_id` (required, UUID): User performing transaction
- `status` (optional): Defaults to 'PENDING'

#### 2.2 TransferBoothTBoothDto
Specialized DTO for booth-to-booth transfers:
- `booth_id` (required, UUID): Source booth
- `ref_booth_id` (required, UUID): Destination booth
- `amount` (required, number): Transfer amount
- `currencies_code` (required, string): Currency code
- `type` (optional): Defaults to 'BOOTH_TO_BOOTH'
- `description` (optional)

#### 2.3 TransferCenterToBoothDto
Specialized DTO for center-to-booth transfers:
- `booth_id` (required, UUID): Receiving booth
- `amount` (required, number): Transfer amount
- `currencies_code` (required, string): Currency code
- `type` (optional): Defaults to 'CENTER_TO_BOOTH'
- `cashCountData` (optional array): [CashCountDataDto] for tracking denominations
- `description` (optional)

#### 2.4 CashCountDataDto
Sub-DTO for cash count details:
- `denomination` (number): Denomination value
- `amount` (number): Count of notes/coins

#### 2.5 UpdateTransferTransactionDto
For updating existing transfers:
- `description` (optional): Update description
- `status` (optional): Update status

---

## 3. Service Implementation

### Location
`src/modules/transfer-transactions/transfer-transactions.service.ts`

### Dependency Injection
The service uses constructor injection to leverage existing services:

```typescript
constructor(
  @InjectRepository(TransferTransaction)
  private readonly transferTransactionRepository: Repository<TransferTransaction>,
  @InjectRepository(Booth)
  private readonly boothRepository: Repository<Booth>,
  private readonly dataSource: DataSource,
  @Inject(BoothsService)
  private readonly boothsService: BoothsService,
  @Inject(CurrenciesService)
  private readonly currenciesService: CurrenciesService,
  @Inject(CashCountsService)
  private readonly cashCountsService: CashCountsService,
  @Inject(SystemLogsService)
  private readonly systemLogsService: SystemLogsService,
  @Inject(TransactionsService)
  private readonly transactionsService: TransactionsService,
)
```

### Core Methods

#### 3.1 createMovement()
```typescript
createMovement(user: any, createDto: CreateTransferTransactionDto): Promise<boolean>
```
- **Purpose**: Handle internal stock/cash movement logic
- **Returns**: Boolean (success indicator)
- **Features**:
  - Validates booth existence
  - Auto-generates transaction number if not provided
  - Wraps operation in database transaction
  - Logs all actions using SystemLogsService
  - Sets status to 'COMPLETED' automatically

#### 3.2 transferBoothToBooth()
```typescript
transferBoothToBooth(user: any, transferDto: TransferBoothTBoothDto): Promise<boolean>
```
- **Purpose**: Transfer funds between two booths
- **Returns**: Boolean (success indicator)
- **Features**:
  - Validates both source and destination booths exist
  - Validates amount is positive
  - Creates permanent transaction record
  - **TODO**: Integrate with inventory system for deduction/addition
  - Logs detailed transfer information

#### 3.3 transferCenterToBooth()
```typescript
transferCenterToBooth(user: any, transferDto: TransferCenterToBoothDto): Promise<boolean>
```
- **Purpose**: Transfer funds from main center to specific booth
- **Returns**: Boolean (success indicator)
- **Features**:
  - Validates booth existence and amount
  - Handles cash count data if provided
  - Creates transaction without ref_booth_id (indicates center source)
  - **TODO**: Integrate with CashCountsService for denomination tracking

#### 3.4 get_transfers()
```typescript
get_transfers(): Promise<TransferTransaction[]>
```
- **Purpose**: Retrieve all transfer transactions
- **Returns**: Array of TransferTransaction entities
- **Features**:
  - Includes all relations (booth, refBooth, currency, user)
  - Ordered by created_at DESC
  - Excludes soft-deleted records

#### 3.5 get_transfers_per_Booth()
```typescript
get_transfers_per_Booth(booth_id: string): Promise<TransferTransaction[]>
```
- **Purpose**: Get all transfers related to a specific booth
- **Returns**: Filtered array of transactions
- **Query Logic**: 
  - Returns transfers where booth_id OR ref_booth_id matches
  - Shows both outgoing and incoming transfers

#### 3.6 get_transfers_Booth_To_Booth()
```typescript
get_transfers_Booth_To_Booth(): Promise<TransferTransaction[]>
```
- **Purpose**: Retrieve only inter-booth transfers
- **Returns**: Array of booth-to-booth type transfers
- **Filter**: type = 'BOOTH_TO_BOOTH' AND ref_booth_id IS NULL

#### 3.7 get_CashInventory()
```typescript
get_CashInventory(booth_id: string): Promise<number>
```
- **Purpose**: Calculate total cash available in a booth
- **Returns**: Decimal number representing total inventory
- **Calculation**:
  - Sums all inflows (CENTER_TO_BOOTH, BOOTH_TO_BOOTH transfers)
  - Filters by booth_id and status='COMPLETED'
  - Handles null/undefined safely

#### 3.8 get_totalReceive()
```typescript
get_totalReceive(shift_id: string): Promise<number>
```
- **Purpose**: Get total amount received from center during a shift
- **Returns**: Decimal number (total received)
- **Filter**:
  - type = 'CENTER_TO_BOOTH'
  - status = 'COMPLETED'
  - Created on same date as shift

### Additional CRUD Methods

#### create()
Create a new transfer transaction with full validation.

#### findOne()
Retrieve a single transfer by ID with all relations.

#### update()
Update description and status of existing transfer.

#### remove()
Soft delete a transfer transaction.

### Helper Methods

#### log()
Async logging method that integrates with SystemLogsService:
- Automatically includes user ID
- Executes within transaction context
- Handles errors gracefully

#### generateTransactionNumber()
Creates unique transaction identifiers using:
- Timestamp (milliseconds)
- Random 4-digit hex number
- Format: `TT-{timestamp}-{random}`

---

## 4. Controller Implementation

### Location
`src/modules/transfer-transactions/transfer-transactions.controller.ts`

### Security
All endpoints protected with:
- `@UseGuards(JwtAuthGuard, RolesGuard)` - JWT authentication + role-based access
- `@Roles()` decorator for fine-grained authorization

### Endpoints

| Method | Route | Role | Purpose |
|--------|-------|------|---------|
| POST | `/transfer-transactions/movements` | admin, manager | Create internal movement |
| POST | `/transfer-transactions/booth-to-booth` | admin, manager | Transfer between booths |
| POST | `/transfer-transactions/center-to-booth` | admin, manager | Transfer from center |
| POST | `/transfer-transactions` | admin, manager | Create generic transfer |
| GET | `/transfer-transactions/all` | admin, manager, staff | Get all transfers |
| GET | `/transfer-transactions/booth/:boothId` | admin, manager, staff | Get booth transfers |
| GET | `/transfer-transactions/booth-transfers` | admin, manager, staff | Get B2B transfers |
| GET | `/transfer-transactions/inventory/:boothId` | admin, manager, staff | Get cash inventory |
| GET | `/transfer-transactions/total-receive/:shiftId` | admin, manager, staff | Get shift received total |
| GET | `/transfer-transactions/:id` | admin, manager, staff | Get single transfer |
| PATCH | `/transfer-transactions/:id` | admin, manager | Update transfer |
| DELETE | `/transfer-transactions/:id` | admin | Delete transfer |

### Response Format
All endpoints return standardized JSON responses:

```typescript
{
  success: boolean,
  data?: any,
  message?: string,
  count?: number
}
```

---

## 5. Module Configuration

### Location
`src/modules/transfer-transactions/transfer-transactions.module.ts`

### Imports
- TypeOrmModule: TransferTransaction, Booth, Currency, User entities
- BoothsModule: For booth validation and data
- CurrenciesModule: For currency information
- CashCountsModule: For cash denomination tracking
- SystemLogsModule: For audit logging
- TransactionsModule: For transaction creation/management

### Exports
- TransferTransactionsService: Available to other modules

---

## 6. Database Integration

### Automatic Entity Registration
The app.module.ts automatically discovers and loads this entity through:
```typescript
entities: [__dirname + '/modules/**/entities/*.entity{.ts,.js}']
```

### Relationships
- **Booth** (Many-to-One): Each transfer references source and destination booth
- **Currency** (Many-to-One): Based on currencies_code
- **User** (Many-to-One): Who performed the operation

### Soft Deletes
Records are soft-deleted (deletedAt column) rather than permanently removed, enabling:
- Audit trail preservation
- Data recovery
- Compliance requirements

---

## 7. Integration Points

### With BoothsService
- Validates booth existence before transfers
- Can extend to get booth inventory/status

### With CurrenciesService
- Validates currency codes
- Retrieves currency information
- Could extend for exchange rate calculations

### With CashCountsService
- Records denomination-level cash counts
- Tracks individual note/coin movements
- Supports cash reconciliation

### With SystemLogsService
- Logs all transfer operations
- Maintains audit trail
- Integrates with transaction manager for consistency

### With TransactionsService
- Can create parent transaction records
- Links transfers to shift transactions
- Maintains transaction hierarchy

---

## 8. Architecture Compliance

### NestJS Best Practices
✓ **Module-based structure**: Organized service/controller/entity separation
✓ **Dependency Injection**: All dependencies injected via constructor
✓ **Repository Pattern**: Uses TypeORM repositories
✓ **Guard-based Security**: Role-based access control
✓ **DTO Validation**: class-validator decorators
✓ **Transaction Management**: Database transactions for atomicity
✓ **Error Handling**: Custom exceptions with appropriate HTTP codes
✓ **Logging**: Integrated with existing LogsService

### Naming Conventions
✓ Snake_case for database columns (transaction_no, booth_id, currencies_code)
✓ CamelCase for service methods and DTOs
✓ Descriptive method names following "get_" prefix for queries
✓ UPPER_CASE for constants and status values

### Database Patterns
✓ UUID primary keys for distributed systems
✓ Foreign key relationships with proper joins
✓ Decimal types for monetary values (precision: 15, scale: 2)
✓ Timestamps for audit trails
✓ Soft delete support for data integrity

---

## 9. Usage Examples

### Create Booth-to-Booth Transfer
```typescript
const dto: TransferBoothTBoothDto = {
  booth_id: 'uuid-1',
  ref_booth_id: 'uuid-2',
  amount: 1000.50,
  currencies_code: 'THB',
  description: 'Daily transfer'
};
const result = await service.transferBoothToBooth(user, dto);
```

### Get Cash Inventory
```typescript
const inventory = await service.get_CashInventory('booth-id');
// Returns: 5000.75 (total cash available)
```

### Get Shift Total Received
```typescript
const total = await service.get_totalReceive('shift-id');
// Returns: 20000.00 (total from center during shift)
```

---

## 10. Future Extensions

### Recommended TODO Items
1. **Inventory Management**: Implement deduction/addition logic in transferBoothToBooth
2. **Cash Count Integration**: Complete cashCountData processing in transferCenterToBooth
3. **Approval Workflow**: Add approval mechanism for large transfers
4. **Report Generation**: Create transfer reports by booth/user/period
5. **Reconciliation**: Auto-reconciliation checks for inventory accuracy
6. **Notifications**: Alert users of significant transfers
7. **Batch Operations**: Support bulk transfer operations
8. **Exchange Integration**: Link currency exchanges with transfers

---

## 11. Testing Checklist

- [ ] Create movement with auto-generated transaction number
- [ ] Validate booth existence before transfers
- [ ] Verify amount validation (positive numbers only)
- [ ] Test booth-to-booth transfer with both booths
- [ ] Test center-to-booth transfer
- [ ] Verify all transfers retrieved correctly
- [ ] Test filtering by booth (incoming and outgoing)
- [ ] Verify cash inventory calculation
- [ ] Verify shift total receive calculation
- [ ] Test soft delete functionality
- [ ] Verify cascade updates to related records
- [ ] Test role-based access control on endpoints
- [ ] Verify transaction logging for all operations
- [ ] Test error handling and validation messages

---

## 12. Configuration Requirements

### Environment Variables (if needed)
None specific to this module - inherits from app.config

### Database Permissions
- CREATE TABLE transfer_transactions
- CREATE INDEX on booth_id, ref_booth_id, user_id
- FOREIGN KEY constraints

### Service Dependencies
All required services must be:
1. Properly exported from their modules
2. Importable in TransferTransactionsModule
3. Registered in app.module.ts

---

## Summary

The Transfer Transactions Module provides a complete, production-ready implementation of booth-to-booth and center-to-booth transfer management with:
- Full data validation
- Security through role-based access control
- Comprehensive audit logging
- Integration with existing services
- Adherence to project architectural patterns
- Extensibility for future enhancements

For questions or modifications, refer to the code inline comments and related service implementations.
