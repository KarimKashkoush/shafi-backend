const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");

const s3 = new S3Client({ region: process.env.AWS_REGION });

const getS3Usage = async (req, res) => {
      try {
            const bucketName = 'shafi-storage';

            let size = 0;
            let continuationToken = undefined;

            do {
                  const response = await s3.send(
                        new ListObjectsV2Command({
                              Bucket: bucketName,
                              ContinuationToken: continuationToken
                        })
                  );

                  if (response.Contents) {
                        response.Contents.forEach(obj => {
                              size += obj.Size || 0;
                        });
                  }

                  continuationToken = response.NextContinuationToken;
            } while (continuationToken);

            const usedMB = (size / (1024 * 1024)).toFixed(2);

            res.json({
                  message: "success",
                  bucket: bucketName,
                  usedMB,
                  usedGB: (usedMB / 1024).toFixed(2)
            });

      } catch (error) {
            console.error("❌ Error in getS3Usage:", error);
            res.status(500).json({ message: "error", error: error.message });
      }
};

module.exports = { getS3Usage };
