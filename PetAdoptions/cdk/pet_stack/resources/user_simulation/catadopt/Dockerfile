FROM --platform=linux/amd64 alpine:latest
 
# Installs latest Chromium (100) package.
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      nodejs \
      npm
 
# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
 
# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install the dependencies
RUN npm ci
 
# Add user so we don't need --no-sandbox.
RUN addgroup -S pptruser && adduser -S -G pptruser pptruser \
    && mkdir -p /home/pptruser/Downloads /app \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app
 
# Run everything after as non-privileged user.
USER pptruser
 
COPY /app/main.js ./
CMD ["node", "main.js"]
