
-- 1. ให้สิทธิ์ User postgres จัดการฐานข้อมูล web_exchank ได้เต็มที่
GRANT ALL PRIVILEGES ON DATABASE web_exchank TO postgres;

-- 2. สลับการเชื่อมต่อเข้าไปที่ Database web_exchank
\c web_exchank;

-- 3. จัดการสิทธิ์ใน Schema `public` (สำคัญมากสำหรับ TypeORM)
GRANT ALL ON SCHEMA public TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;

-- 4. เตรียมความพร้อมเปิดใช้งาน Extension ที่เป็นมาตรฐาน
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
