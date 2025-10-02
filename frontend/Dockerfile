FROM node:20-alpine

LABEL maintainer="Fonflix Team - TG: @fonflix_support" 
LABEL version="1.0"
LABEL description="Fonflix Next.js aplikacija za pristup snimcima predavanja"
LABEL service="frontend"

WORKDIR /app

RUN apk add --no-cache curl

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY


COPY package*.json ./

RUN npm install

RUN addgroup -S app && adduser -S -G app app

COPY . .

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000 || exit 1

CMD ["npm", "start"]


