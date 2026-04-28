import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('shift_stocks_reports')
export class ShiftStocksReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shiftId: string;

  @Column({ type: 'jsonb', nullable: true })
  stockDetails: any;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @DeleteDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  deletedAt?: Date;
}