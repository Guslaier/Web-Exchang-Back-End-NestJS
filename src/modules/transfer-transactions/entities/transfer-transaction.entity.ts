import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Booth } from '../../booths/entities/booth.entity';
import { User } from '../../users/entities/user.entity';
import { Currency } from '../../currencies/entities/currency.entity';

@Entity('transfer_transactions')
export class TransferTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: true })
  transaction_no: string;

  @Column('uuid')
  booth_id: string;

  @ManyToOne(() => Booth, { nullable: false })
  @JoinColumn({ name: 'booth_id' })
  booth: Booth;

  @Column({ nullable: true })
  currency_name: string;

  @Column('decimal', { precision: 15, scale: 2 })
  amount: number;

  @Column()
  currencies_code: string;

  @ManyToOne(() => Currency, { nullable: false })
  @JoinColumn({ name: 'currencies_code' })
  currency: Currency;

  @Column()
  type: string; // BOOTH_TO_BOOTH, CENTER_TO_BOOTH, etc.

  @Column('uuid', { nullable: true })
  ref_booth_id: string;

  @ManyToOne(() => Booth, { nullable: true })
  @JoinColumn({ name: 'ref_booth_id' })
  refBooth: Booth;

  @Column({ nullable: true })
  description: string;

  @Column('uuid')
  user_id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ default: 'PENDING' })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at?: Date;
}