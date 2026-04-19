import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { Booth } from '../../booths/entities/booth.entity';
import { User } from '../../users/entities/user.entity';
import { Currency } from '../../currencies/entities/currency.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import {
  TransferTransactionData,
  TranStatus,
  TransferTransactionType,
} from '../../../types';
import { IsString } from 'class-validator';
import { Shift } from '../../shifts/entities/shift.entity';

@Entity('transfer_transactions')
export class TransferTransaction implements Omit<
  TransferTransactionData,
  'id' | 'boothId' | 'userId' | 'currencyCode' | 'refBoothId' | 'shiftId'
> {
 @PrimaryColumn() // ใช้ ID จาก Transaction แม่
  id: string;

  @OneToOne(() => Transaction)
  @JoinColumn({ name: 'id' })
  transaction: Transaction;

  // แนะนำให้ระบุชื่อ name ใน DB ให้ชัดเจนเพื่อกันพลาด
  @Column('uuid', { name: 'booth_id' })
  boothId: string;

  @ManyToOne(() => Booth)
  @JoinColumn({ name: 'booth_id' })
  booth: Booth;

  @Column('uuid', { name: 'shift_id', nullable: true })
  shiftId?: string | null;

  @ManyToOne(() => Shift)
  @JoinColumn({ name: 'shift_id' })
  shift?: Shift | null;

  @Column('decimal', { precision: 15, scale: 2 })
  amount: number;

  @Column({ name: 'currency_code' })
  currencyCode: string;

  @ManyToOne(() => Currency)
  @JoinColumn({ name: 'currency_code', referencedColumnName: 'code' })
  currency: Currency;

  @Column()
  type: TransferTransactionType;

  @Column('uuid', { name: 'refbooth_id', nullable: true })
  refBoothId: string;

  @ManyToOne(() => Booth)
  @JoinColumn({ name: 'refbooth_id' })
  refBooth: Booth;

  @Column('uuid', { name: 'refshift_id', nullable: true })
  refShiftId?: string | null;

  @ManyToOne(() => Shift)
  @JoinColumn({ name: 'refshift_id' })
  refShift?: Shift | null;
  @Column('uuid', { name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ default: 'PENDING' })
  status: TranStatus;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
