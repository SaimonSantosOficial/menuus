import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'custom-static-assets-and-upload',
        configureServer(server) {
          // 1. Serve static files from root '/img' matching path /img/*
          server.middlewares.use('/img', (req, res, next) => {
            const urlWithoutQuery = req.url?.split('?')[0] || '';
            const filePath = path.join(__dirname, 'img', urlWithoutQuery);
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              res.setHeader('Content-Type', getMimeType(filePath));
              fs.createReadStream(filePath).pipe(res);
            } else {
              next();
            }
          });

          // 2. Handle POST /api/upload
          server.middlewares.use('/api/upload', (req, res, next) => {
            if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => {
                body += chunk;
              });
              req.on('end', () => {
                try {
                  const parsed = JSON.parse(body);
                  const { image, restaurantName, fileName } = parsed;

                  if (!image || !restaurantName) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: "Os dados da imagem e o nome do restaurante são necessários." }));
                    return;
                  }

                  // Sanitize restaurant name
                  const cleanRestaurantName = restaurantName
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-zA-Z0-9\s-_]/g, "")
                    .trim()
                    .replace(/\s+/g, "_");

                  const uploadDir = path.join(__dirname, "img", cleanRestaurantName);
                  if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                  }

                  // Determine content type & binary buffer from data-uri
                  const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                  let imageBuffer: Buffer;
                  let extension = "png";

                  if (matches && matches.length === 3) {
                    const type = matches[1];
                    imageBuffer = Buffer.from(matches[2], "base64");
                    const extMatch = type.split("/");
                    if (extMatch.length === 2) {
                      extension = extMatch[1];
                    }
                  } else {
                    imageBuffer = Buffer.from(image, "base64");
                  }

                  // Format clean destination file name
                  let cleanFileName = `image_${Date.now()}.${extension}`;
                  if (fileName) {
                    const parsedName = path.parse(fileName).name
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^a-zA-Z0-9\s-_]/g, "")
                      .trim()
                      .replace(/\s+/g, "_");
                    cleanFileName = `${parsedName}_${Date.now()}.${extension}`;
                  }

                  const filePath = path.join(uploadDir, cleanFileName);
                  fs.writeFileSync(filePath, imageBuffer);

                  const publicUrl = `/img/${cleanRestaurantName}/${cleanFileName}`;
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, imageUrl: publicUrl }));
                } catch (error: any) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: error.message || "Erro no processamento do upload." }));
                }
              });
            } else {
              next();
            }
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
