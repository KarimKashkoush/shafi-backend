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
      const parallelUpload = new Upload({
            client: s3Client,
            params: {
                  Bucket: process.env.AWS_BUCKET_NAME,
                  Key: `results/${Date.now()}-${file.originalname}`,
                  Body: file.buffer, // هياخد الملف من multer buffer
            },
      });

      const result = await parallelUpload.done();
      return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${parallelUpload.params.Key}`;
}

module.exports = { uploadFileToS3 };
