import { Injectable } from '@nestjs/common';
import { CreateBoothDto,UpdateBoothDto } from './dto/booth.dto';
import { Booth } from './entities/booth.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';


@Injectable()
export class BoothsService {
    constructor(
        @InjectRepository(Booth)
        private readonly boothRepository: Repository<Booth>,
    ) {}

    create(createBoothDto: CreateBoothDto) {
        const booth = this.boothRepository.create(createBoothDto);
        return this.boothRepository.save(booth);
    }

    findAll() {
        return this.boothRepository.find();
    }

    findOne(id: string) {
        return this.boothRepository.findOne({ where: { id } });
    }

    update(id: string, updateBoothDto: UpdateBoothDto) {
        return this.boothRepository.update(id, updateBoothDto);
    }

    remove(id: string) {
        return this.boothRepository.delete(id);
    }   
}