FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache \
    libreoffice \
    font-noto \
    font-noto-cjk \
    ttf-dejavu
COPY package.json package-lock.json ./
RUN npm install --omit=dev
COPY src ./src
ENV NODE_ENV=production
ENV PORT=4000
ENV LIBREOFFICE_BIN=/usr/bin/soffice
ENV HOME=/tmp
EXPOSE 4000
CMD ["node", "src/server.js"]
