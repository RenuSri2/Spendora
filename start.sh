#!/bin/bash
set -e
mkdir -p /app/data/uploads
npx prisma db push --accept-data-loss
npm start
