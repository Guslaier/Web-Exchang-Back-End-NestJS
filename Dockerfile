# syntax=docker/dockerfile:1

# --- Stage: Dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# --- Stage: Build ---
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Stage: Runner (หัวใจสำคัญอยู่ตรงนี้) ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# 1. ติดตั้ง tzdata และตั้งค่า timezone
RUN apk add --no-cache tzdata \
    && cp /usr/share/zoneinfo/Asia/Bangkok /etc/localtime \
    && echo "Asia/Bangkok" > /etc/timezone \
    && apk del tzdata 
    # (แนะนำให้ลบ tzdata ออกหลังตั้งค่าเสร็จเพื่อลดขนาดภาพ ถ้าแอปไม่ได้เรียกใช้ lib นี้โดยตรง)

# 2. ตั้งค่า Environment Variable
ENV TZ=Asia/Bangkok

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

EXPOSE 3001
CMD ["node", "dist/main.js"]