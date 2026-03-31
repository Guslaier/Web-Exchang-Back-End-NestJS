import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn , PrimaryColumn } from 'typeorm';

@Entity('transactions')
export class Transaction {
 @PrimaryColumn()
  id: string;

  @Column()
  type: string;

  @CreateDateColumn()
  createdAt: Date;

}