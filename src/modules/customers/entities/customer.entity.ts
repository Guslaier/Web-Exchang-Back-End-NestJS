import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  passportImg: string;

  @Column() 
  passportNo: string;

  @Column()
  fullName: string;

  @Column()
  nationality: string;

  @Column()
  phoneNumber: string;

  @Column()
  hotelName: string;

  @Column()
  roomNumber: string;

  @CreateDateColumn()
  createdAt: Date;
}