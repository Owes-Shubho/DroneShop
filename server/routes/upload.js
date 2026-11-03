import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { protect, admin } from '../middleware/auth.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
fs.mkdirSync(dir, { recursive: true });

// Only allow common raster image types; the extension is derived from the MIME type, never from the client's filename.
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const upload = multer({
  storage: multer.diskStorage({
    destination: dir,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (EXT[file.mimetype]) return cb(null, true);
    cb(new Error('Only JPG, PNG or WebP images are allowed'));
  },
});

const router = Router();

router.post('/', protect, admin, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      res.status(400);
      return next(err.code === 'LIMIT_FILE_SIZE' ? new Error('Image must be 5 MB or smaller') : err);
    }
    if (!req.file) {
      res.status(400);
      return next(new Error('No image uploaded'));
    }
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  });
});

export default router;
export { dir as uploadDir };
