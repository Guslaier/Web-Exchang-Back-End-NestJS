import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('cash_counts')
export class CashCount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shiftId: string;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column()
  currencyCode: string;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}