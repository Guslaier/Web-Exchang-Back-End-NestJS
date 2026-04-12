import { ExchangeTransaction } from './../../../modules/exchange-transactions/entities/exchange-transaction.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToOne, JoinColumn } from 'typeorm';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  exchangeTransactionId: string;

  @OneToOne(() => ExchangeTransaction, exchangeTransaction => exchangeTransaction.id)
  @JoinColumn({ name: 'exchangeTransactionId' })
  exchangeTransaction: ExchangeTransaction;

  @Column()
  passportImg: string;

  @Column() 
  passportNo: string;

  @Column()
  fullName: string;

  @Column()
  nationality: string;

  @Column()
  phoneNumber: string;

  @Column()
  hotelName: string;

  @Column()
  roomNumber: string;

  @CreateDateColumn()
  createdAt: Date;
}