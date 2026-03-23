import { Booth } from '../../../modules/booths/entities/booth.entity';
import { User } from '../../../modules/users/entities/user.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('shifts')
export class Shift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({type : 'uuid'})
  userId : string;

  @ManyToOne(() => User , (User) => User.id)
  @JoinColumn({name : "userId"})
  user: User;

  @Column({type : 'uuid'}) 
  boothId : string; 

  @ManyToOne(() => Booth , (Booth) => Booth.id)
  @JoinColumn({name : "boothId"})
  booth: Booth;

  @Column({ type: 'timestamp', default : new Date()})
  startTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  endTime: Date;

  @Column({ default: 'OPEN' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}