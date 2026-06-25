# Stage 1: Build the Node.js application
FROM node:20-alpine AS builder

WORKDIR /app/backend

# Copy package.json and package-lock.json first to leverage Docker cache
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy the rest of the application code
COPY backend/ .

# Stage 2: Run the application
FROM node:20-alpine

WORKDIR /app/backend

# Copy only necessary files from the builder stage
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/ .
COPY database/schema.sql ../database/schema.sql

# Expose the port the app runs on
EXPOSE 5000

# Command to run database migrations and then start the application
# This ensures the database is ready before the app tries to connect
CMD npm run migrate && npm start
