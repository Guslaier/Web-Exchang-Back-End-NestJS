import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('currencies')
export class Currency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 3 })
  code: string; // e.g. USD, EUR

  @Column()
  name: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}