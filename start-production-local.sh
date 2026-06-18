#!/bin/bash

# Script: Levantar Bitlogic en modo producción local
# Levanta backend y frontend en paralelo

set -e

echo ""
echo "================================"
echo "🚀 BITLOGIC PRODUCTION LOCAL"
echo "================================"
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Error: No estás en el directorio raíz${NC}"
  exit 1
fi

echo -e "${YELLOW}1. Verificando PostgreSQL...${NC}"
# Intentar conectar a PostgreSQL
if ! psql -U postgres -d bitlogic -c "SELECT 1" > /dev/null 2>&1; then
  echo -e "${RED}⚠️  PostgreSQL no detectado o BD no existe${NC}"
  echo "    Asegúrate que PostgreSQL esté corriendo con:"
  echo "    - Linux/WSL: sudo service postgresql start"
  echo "    - Windows: Services > PostgreSQL > Start"
  echo "    - O usa: sudo -u postgres psql -c \"CREATE DATABASE bitlogic;\""
  echo ""
fi

echo -e "${YELLOW}2. Configuración de entorno...${NC}"
echo "   Frontend URL: http://localhost:5173 (TanStack SSR)"
echo "   Backend URL:  http://localhost:3001"
echo "   API:          http://localhost:3001/api"
echo ""

echo -e "${YELLOW}3. Levantando Backend (npm start)...${NC}"
cd backend
timeout 5 npm start > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "   PID: $BACKEND_PID"

# Esperar que el backend esté listo
echo "   Esperando que PostgreSQL conecte..."
for i in {1..30}; do
  if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "   ${GREEN}✓ Backend OK${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "   ${RED}✗ Backend no inició en 30s${NC}"
    echo "   Revisar logs: cat /tmp/backend.log"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
  fi
  echo -n "."
  sleep 1
done
echo ""

echo -e "${YELLOW}4. Levantando Frontend (npm run preview)...${NC}"
cd ..
npm run preview > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   PID: $FRONTEND_PID"

# Esperar que el frontend esté listo
echo "   Esperando que Vite inicie..."
for i in {1..30}; do
  if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "   ${GREEN}✓ Frontend OK${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "   ${RED}✗ Frontend no inició en 30s${NC}"
    echo "   Revisar logs: cat /tmp/frontend.log"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit 1
  fi
  echo -n "."
  sleep 1
done
echo ""

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ PRODUCCIÓN LOCAL ACTIVO${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "URLs:"
echo -e "  Frontend:  ${GREEN}http://localhost:5173${NC}"
echo -e "  Backend:   ${GREEN}http://localhost:3001${NC}"
echo -e "  API:       ${GREEN}http://localhost:3001/api${NC}"
echo ""
echo "Logs:"
echo "  Backend:  tail -f /tmp/backend.log"
echo "  Frontend: tail -f /tmp/frontend.log"
echo ""
echo "Para detener: Ctrl+C"
echo ""

# Mantener los procesos corriendo
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo -e '\n${YELLOW}Detenido${NC}'" EXIT

wait $BACKEND_PID $FRONTEND_PID
