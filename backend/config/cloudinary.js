const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Streams a buffer straight to Cloudinary using an upload_stream.
 * We deliberately avoid writing media to disk or holding more than
 * one buffer at a time - Baileys gives us the media as a stream we
 * pipe directly into Cloudinary's upload stream.
 *
 * @param {Buffer|Readable} input - buffer or readable stream from Baileys
 * @param {'image'|'video'|'raw'|'auto'} resourceType
 * @param {string} folder - Cloudinary folder, e.g. 'whatsapp/media' or 'whatsapp/status'
 */
function uploadToCloudinary(input, resourceType = 'auto', folder = 'whatsapp/media') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType, folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    if (Buffer.isBuffer(input)) {
      streamifier.createReadStream(input).pipe(uploadStream);
    } else {
      // already a readable stream
      input.pipe(uploadStream);
    }
  });
}

module.exports = { cloudinary, uploadToCloudinary };
