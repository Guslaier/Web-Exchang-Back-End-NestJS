# Project Overview

Web Exchange is a platform to facilitate the exchange of goods and services. This README provides necessary guidelines to set up and run the project.

## First-Time Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file from the provided `.env.example` to configure your environment variables.

3. **Run Docker Compose**
   To start the application and services, run:
   ```bash
   docker-compose up -d --build
   ```
   The `docker-compose.yml` maps port **3002:3002** for the application, **5432** for the database, and **6379** for Redis.

4. **Log Viewing**
   You can view logs using:
   ```bash
   docker-compose logs -f
   ```

5. **Database Connection Settings**
   Ensure that your database connection settings are correctly configured in the `.env` file.

6. **Seeding the Database**
   To seed the database with default data, run:
   ```bash
   npm run seed
   ```
   This will execute `ts-node -r tsconfig-paths/register src/seed.ts`.

7. **Stop/Reset Commands**
   To stop and remove the containers, run:
   ```bash
   docker-compose down
   ```
   To also remove volumes for a full reset, use:
   ```bash
   docker-compose down -v
   ```

## Run Without Docker

You can run the project without Docker using npm scripts. Ensure you meet the following prerequisites:
- **Node.js v20+**

Start the application in development mode using:
```bash
npm run start:dev
```

## Default Seeded Admin Accounts

The following default admin accounts are seeded in the database:
- **Admin Account**:  
  Email: admin@m.exchang.com  
  Password: Admin@123  
- **Secondary Admin Account**:  
  Email: secadmin@m.exchang.com  
  Password: SecAdmin@123  

