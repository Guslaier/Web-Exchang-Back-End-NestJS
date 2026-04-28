import { User } from '../../users/entities/user.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToMany, ManyToOne, DeleteDateColumn, JoinColumn } from 'typeorm';

@Entity('system_logs')
export class SystemLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string | null;

  @ManyToOne(()=> User, { nullable: true }) 
  @JoinColumn({name:'userId'}) 
  user: User ;


  @Column()
  action: string;

  @Column({ type: 'text', nullable: true })
  details: string;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @DeleteDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  deletedAt?: Date;
}