import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  process.env.TZ = 'Asia/Bangkok';
  const app = await NestFactory.create(AppModule);
  const PORT = process.env.PORT || 3000;
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions : {
      enableImplicitConversion : true
    }
  }));
  app.enableCors({
    origin: 'http://localhost:5173', // ระบุ Origin ของ Frontend คุณ
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // อนุญาตให้ส่ง Cookie หรือ Header พิเศษได้
  });

  await app.listen(PORT);
  console.log(`Application is running on: http://localhost:${PORT}`);

  console.log('Current Server Time:', new Date().toString());
}

bootstrap();