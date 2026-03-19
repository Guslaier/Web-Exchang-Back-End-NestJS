export interface UserData {
    id: string;
    username: string;
    passwordHash: string;
    email: string;
    phoneNumber: string;
    role: 'MANAGER' | 'EMPLOYEE'| 'ADMIN';
    createdAt: Date;
    updatedAt: Date;
}

export interface BoothData {
    id: string;
    name: string;
    location: string;
    isActive: boolean;
    isOpen: boolean;
    curran_tShiftId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Shift {
    id: string;
    userId: string;
    boothId: string;
    startTime: Date;
    endTime: Date;
    totalReceive: number;
    totalExchange: number;
}

export interface Customer {
    id: string;
    passportImageUrl: string;
    passportNo: string;
    fullName: string;
    nationality: string;
    phoneNumber: string;
    hotelNumber: string;
    roomNumber: string;
}

export interface Transaction {
    transactionNo: string;
    shiftId: string;
    type: string;
    customerId: string;
    currencyName: string;
    exchangeType: string;
    thaiAmount: number;
    note: string;
}

export interface CashCountData {
    transactionNo: string;
    amount: number;
    currencyId: string;
}

export interface Currency {
    id: string;
    name: string;
    buyRate: number;
    sellRate: number;
}

export interface RateDTO {
    buyRate: number;
    sellRate: number;
}

export interface ExclusiveExchangeRate {
    id: string;
    boothId: string;
    buyRate: number;
    sellRate: number;
}

export interface ShiftThaiCashflowReport {
    shiftId: string;
    currencyName: string;
    totalBuy: number;
    totalSell: number;
    totalPending: number;
    totalTransferIn: number;
    totalTransferOut: number;
}

export interface ShiftThaiCashReport {
    shiftId: string;
    cash: string;
    quantity: number;
}

export interface SystemLog {
    id: string;
    userId: string;
    action: string;
    description: string;
    createdAt: Date;
}