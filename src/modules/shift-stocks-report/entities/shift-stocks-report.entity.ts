import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('shift_stocks_reports')
export class ShiftStocksReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shiftId: string;

  @Column({ type: 'jsonb', nullable: true })
  stockDetails: any;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}