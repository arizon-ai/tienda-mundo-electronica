FROM node:20-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy all site files
COPY . .

# Remove files that shouldn't be in the image
RUN rm -f Dockerfile nginx.conf .gitignore .gitattributes && \
    rm -rf .git assets/Docs\ Legales* && \
    rm -f *.ps1 *.md

EXPOSE 3000

CMD ["node", "server.js"]
