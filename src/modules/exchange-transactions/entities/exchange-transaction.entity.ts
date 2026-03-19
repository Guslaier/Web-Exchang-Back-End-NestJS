import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('exchange_transactions')
export class ExchangeTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  customerId: string;

  @Column()
  currencyCode: string;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column('decimal', { precision: 10, scale: 4 })
  appliedRate: number;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}