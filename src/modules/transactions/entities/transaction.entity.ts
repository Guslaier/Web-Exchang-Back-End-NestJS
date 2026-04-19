import { TranSectionType } from 'index';
import { Shift } from './../../../modules/shifts/entities/shift.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn , PrimaryColumn, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { ExchangeTransaction } from '../../exchange-transactions/entities/exchange-transaction.entity';

@Entity('transactions')
export class Transaction {
 @PrimaryColumn()
  id: string;

  @Column()
  type: TranSectionType;

  @Column({ nullable: true })
  shiftId: string | null;

  @ManyToOne(() => Shift, (shift) => shift.id)
  @JoinColumn({ name: 'shiftId' })
  shift: Shift;

  @CreateDateColumn()
  createdAt: Date;

  @OneToOne(() => ExchangeTransaction ,(ExchangeTransaction) => ExchangeTransaction.transaction)
  exchangetransaction: any;
  

}