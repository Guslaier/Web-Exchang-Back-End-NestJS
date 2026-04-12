import { Shift } from './../../../modules/shifts/entities/shift.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn , PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('transactions')
export class Transaction {
 @PrimaryColumn()
  id: string;

  @Column()
  type: string;

  @Column({ nullable: true })
  shiftId: string;

  @ManyToOne(() => Shift, (shift) => shift.id)
  @JoinColumn({ name: 'shiftId' })
  shift: Shift;

  @CreateDateColumn()
  createdAt: Date;

}