FROM python:3.8-slim

# Create a new user
RUN useradd -ms /bin/bash appuser

# Set the working directory to /app
WORKDIR /app

# Install any needed packages specified in requirements.txt
RUN apt-get update && apt-get install -y \
    wget \
    xvfb \
    unzip \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libgbm1 \
    libgtk-3-0 \
    libpango-1.0-0 \
    libu2f-udev \
    libvulkan1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

#Install Google Chrome
RUN apt-get install -y wget
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \ 
    && echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list
RUN apt-get update && apt-get -y install google-chrome-stable

# Explicitly set the Chrome version for ChromeDriver
ENV CHROME_VERSION "99.0.4844.51"

# Download and install ChromeDriver
RUN wget https://chromedriver.storage.googleapis.com/$CHROME_VERSION/chromedriver_linux64.zip
RUN unzip chromedriver_linux64.zip -d /usr/local/bin/

# Change ownership to the new user
RUN chown -R appuser:appuser /app

# Switch to the new user
USER appuser

#Add Content to 
ADD . /app

# Install pip
RUN python -m ensurepip --default-pip

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r ./requirements.txt

# Make port 80 available to the world outside this container
EXPOSE 80

# Run load_test.py when the container launches
CMD ["python", "path_testing.py"]
