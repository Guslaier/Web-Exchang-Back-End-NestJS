export type UserRole = "ADMIN" | "MANAGER" | "EMPLOYEE" ; // อิงตาม Database
export type TranStatus = "COMPLETED" | "PENDING" | "VOIDED" | "CANCELED"; // อิงตาม Database
export type TranSectionType =  "EXCHANGE" | "TRANSFER"; // อิงตาม Database
export type TransferTransaction =  "CASH_IN" | "CASH_OUT" | 'TRANSFER_IN' | 'TRANSFER_OUT'; // สำหรับการโอนเงินระหว่างสาขา
export type TranType = "BUY" | "SELL" ; // อิงตาม Database

//== User Interfaces ==//
export interface UserData {
    readonly id: string;
    username: string;
    passwordHash: string;
    email: string;
    phoneNumber: string;
    role: UserRole;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

//== Booth Interfaces ==//
export interface BoothData {
    readonly id: string;
    name: string;
    location: string;
    isActive: boolean;
    isOpen: boolean;
    currentShiftId: string | null; // ใช้สำหรับเช็คว่าบูธนี้มีการเปิดกะอยู่หรือไม่
    createdAt: Date;
    updatedAt: Date;
}

//== Transaction Shift Interfaces ==//
export interface ShiftData {
    readonly id: string;              // id (PK)
    userId: string;          // user_id (FK)
    boothId: string;         // booth_id (FK)
    dateShift: Date;         // date_shift
    startTime: Date;         // shift_start
    endTime: Date;           // shift_end
    totalReceive: number;    // total_receive
    totalExchange: number;   // total_exchange
    balance: number;         // balance
    balanceCheck: number;    // balance_check
    cashAdvance: number;     // cash_advance
    createdAt: Date;         // created_at
    updatedAt: Date;         // updated_at
}

//== Customer Interfaces ==//
export interface CustomerData {
    readonly id: string;               // PK จากในรูป
    passportImageUrl: string; // passport image url
    passportNo: string;       // passport no
    fullName: string;         // fullname
    nationality: string;      // nationality
    phoneNumber: string;      // phone number
    hotelName: string;        // แก้จาก hotelNumber เป็น hotelName ให้ตรงตามรูป
    roomNumber: string;       // room number
    createdAt: Date; // เพิ่มฟิลด์สุดท้ายที่อยู่ในรูปครับ
    updatedAt: Date; // เพิ่มฟิลด์สุดท้ายที่อยู่ในรูปครับ
}

//== Transaction Interfaces ==//
export interface TransactionData {
    readonly transactionNo: string;
    shiftId: string;
    type: TranType;
    createdAt: Date;
    updatedAt: Date;
}

export interface TransferTransactionData {
     readonly transactionNo: string;     // PK, FK (Primary Key & Foreign Key)
    readonly exchangeRatesId: string;   // FK
    readonly boothId: string;           // FK
     amount: number;            // จำนวนเงิน
     type: TranSectionType;     // ประเภทการโอน
     refBoothId: string;        // ID บูธที่อ้างอิง
     description?: string;      // รายละเอียด (ใส่ ? เพราะปกติมักจะเป็น optional)
     userId: string;            // ผู้ทำรายการ
     status: TranStatus;        // สถานะ (เช่น success, pending, cancel)
     createdAt: Date;
     updatedAt: Date;
}

export interface ExchangeTransactionData {
    readonly transactionNo: string;      // PK, FK
    readonly customerId: string;         // customer_id
    readonly exchangeRatesId: string;    // FK (อ้างอิงไปยังตารางเรท)
     type: TranType;             // type (แนะนำให้ใช้ union type ถ้ามีแค่ซื้อ/ขาย)
     exchangeRate: number;       // exchange rate
     foreignAmount: number;      // foreign amount (จำนวนเงินต่างประเทศ)
     calculateMethod: string;    // calculate method
     thaiBahtAmount: number;     // thai baht amount (จำนวนเงินไทย)
     status: TranStatus;         // status
     voidReason?: string;        // void reason (optional)
     voidBy?: string;            // void by (optional)
     approvedBy: string;         // approved by
     note?: string;              // note
     updatedAt: Date;
     createdAt: Date;
}


export interface CashCountData {
    readonly id: string;               // PK
    readonly currenciesCode: string;   // FK (เช่น 'USD', 'THB')
    readonly transactionNo: string;    // FK (เชื่อมกับ exchange_transactions)
    denomination: number;     // มูลค่าหน้าบัตร (เช่น 100, 500, 1000)
    amount: number;           // จำนวนฉบับ หรือ ผลรวมมูลค่า
    createdAt: Date;
    updatedAt: Date;
}

//== Currency Interfaces ==//
export interface Currency {
    readonly code: string;       // PK (เช่น 'USD', 'EUR', 'JPY')
    readonly name: string;       // ชื่อเต็ม (เช่น 'United States Dollar')
    symbol: string;     // สัญลักษณ์ (เช่น '$', '€', '¥')
    buyRate: number;    // อัตราที่ร้านรับซื้อ
    sellRate: number;   // อัตราที่ร้านขายออก
    isActive: boolean;  // สถานะการใช้งาน (true/false)
}

export interface ExchangeRate {
    readonly id: string;               // PK
    readonly currencyCode: string;     // FK (เช่น 'USD', 'JPY')
    name: string;             // ชื่อเรียก (เช่น 'USD 50-100', 'USD 5-20')
    rangeStart: number;       // ช่วงเริ่มต้นของมูลค่าธนบัตร
    rangeStop: number;        // ช่วงสิ้นสุดของมูลค่าธนบัตร
    formalBuy: string;        // ราคาที่ร้านรับซื้อ
    formalSell: string;       // ราคาที่ร้านขายออก
    createdAt: Date;
    updatedAt: Date;
}

export interface ExclusiveExchangeRate {
    readonly exchangeRateId: string;    // PK, FK (เชื่อมกลับไปยัง exchange_rates)
    formulaBuy: string;        // สูตรการคำนวณฝั่งซื้อ (อาจเก็บเป็น string หรือ expression)
    formulaBuyMax: string;     // สูตรการคำนวณสูงสุดฝั่งซื้อ
    buyRate: number;           // เรทซื้อที่กำหนดมาโดยตรง
    buyRateMax: number;        // เรทซื้อสูงสุดที่อนุญาต
    boothId: string;           // FK (ระบุว่าเรทพิเศษนี้ใช้กับบูธไหน)
    createdAt: Date;
    updatedAt: Date;
}


//== Report Interfaces ==//
export interface ShiftStocksReport {
    readonly shiftId: string;           // PK, FK (เชื่อมกับตาราง shifts)
    readonly currencyCode: string;      // PK, FK (เช่น 'USD', 'EUR')
    totalBuy: number;          // ยอดรวมการซื้อเข้า
    totalSell: number;         // ยอดรวมการขายออก
    totalPending: number;      // ยอดที่รอการยืนยัน
    totalTransferIn: number;   // ยอดรวมการโอนเข้า (total tranfer in)
    totalTransferOut: number;  // ยอดรวมการโอนออก (total tranfer out)
    createdAt: Date;
    updatedAt: Date;
}

export interface ShiftThaiCashflowReport {
    readonly shiftId: string;        // PK, FK (เชื่อมกับตาราง shifts)
    readonly denomination: number;   // PK (มูลค่าธนบัตร เช่น 20, 50, 100, 500, 1000)
    quantity: number;       // จำนวนใบ (ในรูปสะกดว่า quanity)
    createdAt: Date;
    updatedAt: Date;
}


//== System Log Interface ==//
export interface SystemLog {
    readonly id: string;               // PK
    readonly userId: string;           // FK (เชื่อมกับตาราง users เพื่อดูว่าใครเป็นคนทำ)
    action: string;           // การกระทำ (เช่น 'LOGIN', 'CREATE_TRANSACTION', 'UPDATE_RATE')
    description: string;      // รายละเอียดของกิจกรรมนั้นๆ
    createdAt: Date;          // วันเวลาที่เกิดเหตุการณ์
    updatedAt: Date;
}