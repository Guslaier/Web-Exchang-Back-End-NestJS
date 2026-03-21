// exchange-rates/entities/exchange-rate.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Currency } from '../../currencies/entities/currency.entity';

@Entity('exchange_rates')
export class ExchangeRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // เช่น "Standard Rate", "VIP Rate"

  @Column()
  currencyId: string; // FK

  @ManyToOne(() => Currency, (currency) => currency.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'currencyId' })
  currency: Currency;

  @Column({ default: 0 })
  range_start: number;

  @Column({ default: 999999 })
  range_stop: number;

  @Column({ default: 'BASE' })
  formula_buy: string; // สูตรคำนวณ เช่น base_rate + 0.05

  @Column({ default: 'BASE' })
  formula_sell: string;

  // exchange-rate.entity.ts

  @Column('decimal', {
    precision: 17, // รวมทั้งหมด 17 หลัก
    scale: 6, // ทศนิยม 6 ตำแหน่ง
    default: 0,
    transformer: {
      // Transformer ช่วยแปลง String จาก Postgres (Decimal) กลับเป็น Number ใน NestJS
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  buy_rate: number;

  @Column('decimal', { precision: 17, scale: 6, default: 0 ,transformer: {
      // Transformer ช่วยแปลง String จาก Postgres (Decimal) กลับเป็น Number ใน NestJS
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },})
  sell_rate: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
