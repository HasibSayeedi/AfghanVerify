# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app

# Restore dependencies before copying source code to maximize Docker layer caching.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

# Empty by default: the production Nginx container proxies these same-origin paths.
ARG VITE_API_BASE_URL=""
ARG VITE_PUBLIC_VERIFY_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_PUBLIC_VERIFY_BASE_URL=${VITE_PUBLIC_VERIFY_BASE_URL}

RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
