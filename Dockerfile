# syntax=docker/dockerfile:1

# ============================================================
# Etapa 1: Build de la aplicación React + Vite
# ============================================================
FROM node:24-alpine AS builder

WORKDIR /app

# Variables de entorno de Vite (se pasan en tiempo de build)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Copiar archivos de definición de dependencias
COPY package.json package-lock.json ./

# Instalar dependencias (incluye devDependencies para build y lint)
RUN npm ci --no-audit --no-fund

# Copiar el resto del código fuente
COPY . .

# Ejecutar lint (opcional; oxlint devuelve 0 aunque haya warnings)
# RUN npm run lint

# Construir la aplicación para producción (genera carpeta dist/)
RUN npm run build

# ============================================================
# Etapa 2: Servidor nginx (runtime ligero)
# ============================================================
FROM nginx:1.27-alpine

# Puerto dinámico (inyectado por Render/Railway; en local usamos 80)
ENV PORT=80

# Copiar plantilla de configuración de nginx
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template

# Copiar solo los archivos estáticos construidos desde la etapa builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
