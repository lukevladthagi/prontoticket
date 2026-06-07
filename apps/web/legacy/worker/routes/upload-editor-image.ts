import { Hono } from "hono";

const router = new Hono<{ Bindings: Env }>();

interface Env {
  R2_BUCKET: R2Bucket;
  MOCHA_R2_PUBLIC_URL: string;
}

router.post("/", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }

    if (!file.type.startsWith("image/")) {
      return c.json({ error: "File must be an image" }, 400);
    }

    // Generate unique filename
    const ext = file.name.split(".").pop() || "png";
    const filename = `editor-images/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await c.env.R2_BUCKET.put(filename, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // Return public URL
    const url = `${c.env.MOCHA_R2_PUBLIC_URL}/${filename}`;

    return c.json({ url });
  } catch (error) {
    console.error("Error uploading editor image:", error);
    return c.json({ error: "Failed to upload image" }, 500);
  }
});

export default router;
