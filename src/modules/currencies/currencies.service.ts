import { Injectable } from '@nestjs/common';
import { Currency } from './entities/currency.entity'; // Assuming you have a Currency entity defined// Assuming you have a DTO for currency
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class CurrenciesService {
    constructor(
        @InjectRepository(Currency)
        private readonly currencyRepository: Repository<Currency>,
    ) {}

    
}