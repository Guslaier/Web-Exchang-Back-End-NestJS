import exp from "constants";
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { ExchangeRate } from '../../exchange-rates/entities/exchange-rate.entity';
import { Shift } from '../../shifts/entities/shift.entity';
import { StockData } from '../../../types/index';

@Entity('stocks')
export class Stock implements StockData {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    shiftId: string ;

    @ManyToOne(() => Shift, (shift) => shift.id)
    @JoinColumn({ name: 'shiftId' })
    shift: Shift; 

    @Column()
    exchangeRateId: string;

    @ManyToOne(() => ExchangeRate, (exchangeRate) => exchangeRate.id)
    @JoinColumn({ name: 'exchangeRateId' })
    exchangeRate: ExchangeRate;

    @Column('decimal', { precision: 12, scale: 2  , default : 0 })
    total_received: number ;

    @Column('decimal', { precision: 12, scale: 2  , default : 0 })
    total_exchanged: number ;

    @Column('decimal', { precision: 12, scale: 2  , default : 0 })
    total_balance: number ;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

}