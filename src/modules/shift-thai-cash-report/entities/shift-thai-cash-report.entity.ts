import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('shift_thai_cash_reports')
export class ShiftThaiCashReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shiftId: string;

  @Column('decimal', { precision: 12, scale: 2 })
  totalThaiCash: number;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}