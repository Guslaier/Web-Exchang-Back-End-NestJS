import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('transfer_transactions')
export class TransferTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fromBoothId: string;

  @Column()
  toBoothId: string;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column()
  currencyCode: string;

  @Column({ default: 'PENDING' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}