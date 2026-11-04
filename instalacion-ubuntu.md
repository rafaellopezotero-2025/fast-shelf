# Instalación del sistema en Ubuntu (paso a paso)

Guía para poner la aplicación a funcionar en una máquina o servidor con Ubuntu.
Está pensada para seguirse de arriba hacia abajo, copiando y pegando los comandos.

---

## Antes de empezar: qué necesitás

1. Una PC o servidor con Ubuntu (24.04 o posterior) y acceso a la terminal.
2. El código del proyecto (descargado desde GitHub, o el archivo ZIP del proyecto).
3. Los datos de conexión al backend (base de datos, usuarios y funciones). Son tres
   valores que ya existen en el archivo `.env` del proyecto:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`

   > Importante: el sistema guarda todos los datos (ventas, stock, caja) en el backend en la
   > nube. Aunque el sitio corra en tu servidor local, sigue necesitando internet para
   > conectarse a esos datos.

---

## Paso 1 — Actualizar Ubuntu

```bash
sudo apt update && sudo apt upgrade -y
```

## Paso 2 — Instalar herramientas básicas

```bash
sudo apt install -y curl git unzip
```

## Paso 3 — Instalar Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Verificá que quedó instalado:

```bash
node -v    # debe mostrar v22.x
npm -v
```

## Paso 4 — Traer el código

Con Git (recomendado):

```bash
cd ~
git clone <URL-DEL-REPOSITORIO> libreria
cd libreria
```

O si tenés el ZIP (el archivo viene con una carpeta `fast-shelf/` adentro):

```bash
cd ~
unzip fast-shelf.zip
mv fast-shelf libreria
cd libreria
ls package.json   # tiene que existir acá; si no, estás en la carpeta equivocada
```

## Paso 5 — Instalar las dependencias

```bash
npm install
```

Tarda unos minutos la primera vez.

## Paso 6 — Crear el archivo de configuración `.env`

En la carpeta del proyecto:

```bash
nano .env
```

Pegá dentro (reemplazando por tus valores reales):

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxx
VITE_SUPABASE_PROJECT_ID=xxxxxxxx

SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxx
SUPABASE_PROJECT_ID=xxxxxxxx
```

Guardá con `Ctrl+O`, `Enter`, y salí con `Ctrl+X`.

## Paso 7 — Probar en modo desarrollo (opcional pero recomendado)

```bash
npm run dev
```

Abrí en el navegador `http://localhost:8080`. Si entrás y podés iniciar sesión, está todo bien.
Cortá con `Ctrl+C`.

## Paso 8 — Generar la versión final (build)

El sitio se compila para correr con Node en tu servidor:

```bash
NITRO_PRESET=node-server npm run build
```

Al terminar queda una carpeta `.output/` con todo lo necesario.

## Paso 9 — Levantar el sitio

```bash
node .output/server/index.mjs
```

Por defecto queda escuchando en `http://localhost:3000`.
Para elegir otro puerto:

```bash
PORT=8080 node .output/server/index.mjs
```

## Paso 10 — Que arranque solo al prender la máquina

Creamos un servicio del sistema.

```bash
sudo nano /etc/systemd/system/libreria.service
```

Pegá esto (ajustá `TU_USUARIO` y la ruta si es distinta):

```ini
[Unit]
Description=Sistema Libreria
After=network.target

[Service]
Type=simple
User=TU_USUARIO
WorkingDirectory=/home/TU_USUARIO/libreria
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/home/TU_USUARIO/libreria/.env
ExecStart=/usr/bin/node /home/TU_USUARIO/libreria/.output/server/index.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Activalo:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now libreria
sudo systemctl status libreria
```

Para ver los mensajes del sistema:

```bash
journalctl -u libreria -f
```

## Paso 11 — Acceder desde otras computadoras del local

Averiguá la IP del servidor:

```bash
hostname -I
```

Desde otra PC de la red entrás con `http://IP-DEL-SERVIDOR:3000`.

Si tenés el firewall activo, habilitá el puerto:

```bash
sudo ufw allow 3000/tcp
```

## Paso 12 (opcional) — Usar una dirección más linda con Nginx

Así entrás con `http://libreria` o con el puerto 80 en vez de `:3000`.

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/libreria
```

Contenido:

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activalo:

```bash
sudo ln -s /etc/nginx/sites-available/libreria /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
sudo ufw allow 'Nginx Full'
```

---

## Actualizar el sistema cuando haya cambios

```bash
cd ~/libreria
git pull
npm install
NITRO_PRESET=node-server npm run build
sudo systemctl restart libreria
```

---

## Problemas frecuentes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| Pantalla en blanco | Falta el `.env` o tiene valores mal copiados | Revisá el Paso 6 y volvé a compilar |
| "No se puede iniciar sesión" | El servidor no llega a internet | Probá `ping google.com` |
| El puerto está ocupado | Otro programa usa el 3000 | Cambiá `PORT` en el servicio |
| `npm install` falla | Versión vieja de Node | Repetí el Paso 3 y verificá `node -v` |
| El servicio no arranca | Ruta o usuario mal escritos | `journalctl -u libreria -n 50` para ver el detalle |

---

## Impresión de tickets y fotocopias

La aplicación imprime usando el diálogo de impresión del navegador. Configurá la impresora
en Ubuntu (Configuración → Impresoras) y elegila como predeterminada; después, al imprimir
desde el sistema, saldrá directo por esa impresora.
