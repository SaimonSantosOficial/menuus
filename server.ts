import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Maximize payload size for base64 file upload limits (e.g., high resolution food images)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Pre-create the 'img' directory at the root on server startup to ensure it is always present
  const rootImgDir = path.join(process.cwd(), "img");
  if (!fs.existsSync(rootImgDir)) {
    fs.mkdirSync(rootImgDir, { recursive: true });
  }

  // Migrate any existing files from old public/img to root /img/ list if exists
  const oldPublicImgDir = path.join(process.cwd(), "public", "img");
  if (fs.existsSync(oldPublicImgDir)) {
    try {
      const copyRecursive = (src: string, dest: string) => {
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };
      copyRecursive(oldPublicImgDir, rootImgDir);
      console.log("Migração de public/img para /img concluída com sucesso.");
    } catch (migErr) {
      console.warn("Aviso na migração de imagens antigas:", migErr);
    }
  }

  // API route for uploading files
  app.post("/api/upload", async (req, res) => {
    try {
      const { image, restaurantName, fileName } = req.body;

      if (!image || !restaurantName) {
        return res.status(400).json({ error: "Os dados da imagem e o nome do restaurante são necessários." });
      }

      // Sanitize restaurant name to create a safe folder path
      const cleanRestaurantName = restaurantName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-zA-Z0-9\s-_]/g, "") // remove non-alphanumeric except spaces, hyphens, underscores
        .trim()
        .replace(/\s+/g, "_"); // replace spaces with underscores

      const uploadDir = path.join(process.cwd(), "img", cleanRestaurantName);

      // Create directories recursively if they don't exist
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

      // Output absolute paths for static serving relative url
      const publicUrl = `/img/${cleanRestaurantName}/${cleanFileName}`;

      return res.json({ success: true, imageUrl: publicUrl });
    } catch (error: any) {
      console.error("Erro no processamento do upload:", error);
      return res.status(500).json({ error: error.message || "Ocorreu um erro interno ao salvar o upload." });
    }
  });

  // Serve static images directly through the Express router to handle both production and development seamlessly
  app.use("/img", express.static(path.join(process.cwd(), "img")));

  // Mount Vite environment or static dist depending on phase
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server rodando em http://localhost:${PORT}`);
  });
}

startServer();
