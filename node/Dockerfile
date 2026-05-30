# 默认国内 Docker 基础镜像 + 阿里云 Debian apt（云主机上清华源常 403）

ARG NODE_IMAGE=docker.1ms.run/library/node:20-bookworm-slim
FROM ${NODE_IMAGE}

WORKDIR /app

ARG APT_MIRROR=cn

RUN set -eux; \
    if [ "$APT_MIRROR" = "cn" ]; then \
      rm -rf /etc/apt/sources.list.d/*; \
      echo 'deb http://mirrors.aliyun.com/debian bookworm main contrib non-free non-free-firmware' > /etc/apt/sources.list; \
      echo 'deb http://mirrors.aliyun.com/debian bookworm-updates main contrib non-free non-free-firmware' >> /etc/apt/sources.list; \
      echo 'deb http://mirrors.aliyun.com/debian-security bookworm-security main contrib non-free non-free-firmware' >> /etc/apt/sources.list; \
    fi; \
    apt-get update; \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ca-certificates; \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      libreoffice-writer-nogui \
      libreoffice-calc-nogui \
      libreoffice-impress-nogui \
      fonts-noto-cjk; \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV PORT=4000
ENV LIBREOFFICE_BIN=/usr/bin/soffice
ENV HOME=/tmp

EXPOSE 4000
CMD ["node", "src/server.js"]
