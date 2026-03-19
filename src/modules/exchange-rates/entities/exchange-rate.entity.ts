import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('exchange_rates')
export class ExchangeRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  currencyCode: string;

  @Column('decimal', { precision: 10, scale: 4 })
  buyRate: number;

  @Column('decimal', { precision: 10, scale: 4 })
  sellRate: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}