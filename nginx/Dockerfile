FROM nginx:alpine

# Instaliraj curl za health check
RUN apk add --no-cache curl

# Kopiraj nginx konfiguraciju
COPY nginx.conf /etc/nginx/nginx.conf

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]