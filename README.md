# Web-Exchank Backend API

โปรเจกต์ API สำหรับระบบ **Web-Exchank** พัฒนาขึ้นด้วยเทคโนโลยีล่าสุด เพื่อให้มีความเร็ว ปลอดภัย และดูแลรักษาง่าย

## เทคโนโลยีที่ใช้
- **Framework:** NestJS (TypeScript)
- **Database:** PostgreSQL
- **ORM:** TypeORM
- **Authentication:** JWT (JSON Web Token), Passport, bcrypt
- **Infrastructure:** Docker & Docker Compose (รองรับ Hot Reload)

---

## ขั้นตอนการรันโปรเจกต์จาก 0 
### ข้อกำหนดเบื้องต้น (Prerequisites)
ก่อนเริ่ม โปรดมั่นใจว่าคุณได้ติดตั้งโปรแกรมเหล่านี้แล้ว:
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (หรือ Docker Daemon)
- (ตัวเลือกเพิ่มเติม) Node.js (v20+) กรณีที่ต้องการรันคำสั่ง npm ในเครื่องตรงๆ
- เครื่องมือจัดการ Database เช่น **DBeaver** หรือ **pgAdmin**

### ขั้นตอนการเปิดใช้งานครั้งแรก

1. เปิด Terminal ในโฟลเดอร์ \`BACK\`
2. ไม่จำเป็นต้องแก้ไฟล์ \`.env\` เพราะเราเตรียมค่าเริ่มต้นสำหรับการทำ Development ไว้พร้อมใช้งานแล้ว

รันคำสั่งนี้เพื่อสร้างและเริ่มทำงานฐานข้อมูล (PostgreSQL) และ API Server (NestJS):
```bash
docker-compose up -d --build
```

### ตรวจสอบการทำงานของระบบ

คุณสามารถดู Log ในการทำงาน (รวมถึง Hot Reload เวลามีการแก้โค้ด) ได้ด้วยคำสั่ง:
```bash
docker-compose logs -f api
```
*(กด \`Ctrl+C\` เพื่อออกจากการดู Log)*

หากระบบเริ่มทำงานสำเร็จ คุณจะเห็นข้อความ \`Nest application successfully started\`

ตอนนี้ API ของคุณสามารถเข้าถึงได้แล้วที่:
**[http://localhost:3002](http://localhost:3002)**

---

## การเชื่อมต่อฐานข้อมูล (Database Connection)

คุณสามารถดูข้อมูลที่อยู่ใน Database ผ่าน **DBeaver** หรือ **pgAdmin** ได้เลยโดยใช้ข้อมูลตั้งค่าดังนี้:
- **Host:** \`localhost\`
- **Port:** \`5432\`
- **User:** \`postgres\`
- **Password:** \`postgres\`
- **Database:** \`web_exchank\`

---

## การหยุดระบบ (Stop/Shutdown)

เมื่อต้องการปิดการทำงานของ Container ทั้งหมด:
```bash
docker-compose down
```

**หมายเหตุสำคัญ:** หากคุณต้องการล้างฐานข้อมูลทิ้งทั้งหมด (Reset Database) ให้ใช้คำสั่ง:
```bash
docker-compose down -v
```
*(คำสั่งนี้จะลบ Volume ที่เก็บข้อมูล Postgres ทิ้งทั้งหมด เมื่อรัน \`up\` ครั้งหน้า จะได้ฐานข้อมูลใหม่ที่ว่างเปล่า)*

---

## 📡 API Endpoints เบื้องต้น

ระบบปัจจุบันได้เตรียมระบบสมาชิกรองรับ Authentication (ลงทะเบียน/ล็อกอิน) ไว้แล้ว:

### 1. สมัครสมาชิก (Register)
- **POST** \`/auth/register\`
- **Body JSON:**
  ```json
  {
    "email": "test@example.com",
    "password": "password123"
  }
  ```
- **Response:** \`{ "accessToken": "eyJhb..." }\`

### 2. ล็อกอิน (Login)
- **POST** \`/auth/login\`
- **Body JSON:**
  ```json
  {
    "email": "test@example.com",
    "password": "password123"
  }
  ```
- **Response:** \`{ "accessToken": "eyJhb..." }\`


