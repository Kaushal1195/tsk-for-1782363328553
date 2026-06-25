# Stage 1: Build the React application
FROM node:20-alpine AS builder

WORKDIR /app/frontend

# Copy package.json and package-lock.json first to leverage Docker cache
COPY frontend/package*.json ./
RUN npm install

# Copy the rest of the application code
COPY frontend/ .

# Build the React app for production
# VITE_BACKEND_URL will be passed during docker-compose build or CI/CD
ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Copy the built React app from the builder stage to Nginx's public directory
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Copy custom Nginx configuration (optional, but good practice)
# If you have a custom nginx.conf, place it in frontend/nginx.conf
# COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 for the web server
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
