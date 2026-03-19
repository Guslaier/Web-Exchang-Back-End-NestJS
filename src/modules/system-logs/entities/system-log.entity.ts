import { User } from '../../users/entities/user.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToMany, ManyToOne, DeleteDateColumn } from 'typeorm';

@Entity('system_logs')
export class SystemLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  action: string;

  @Column({ type: 'text', nullable: true })
  details: string;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}