const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");

const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
});

async function uploadFileToS3(file) {
      // إزالة المسافات + تحويلها لـ "_"
      const safeFileName = file.originalname.replace(/\s+/g, "_");
      const key = `results/${Date.now()}-${safeFileName}`;

      const parallelUpload = new Upload({
            client: s3Client,
            params: {
                  Bucket: process.env.AWS_BUCKET_NAME,
                  Key: key,
                  Body: file.buffer,
                  ContentType: file.mimetype,
            },
      });

      await parallelUpload.done();

      // رجع اللينك المباشر مش الـ key
      return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

module.exports = { uploadFileToS3, s3Client };
