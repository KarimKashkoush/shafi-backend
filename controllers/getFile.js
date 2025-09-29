const { s3Client } = require("../middleware/s3");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

async function getFile(req, res) {
      try {
            const key = req.params.key; // ✅ هيشمل أي حاجة حتى لو فيها "/"
            if (!key) return res.status(400).json({ message: "Key مطلوب" });

            const command = new GetObjectCommand({
                  Bucket: process.env.AWS_BUCKET_NAME,
                  Key: key,
            });

            // صلاحية ساعة واحدة
            const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

            return res.json({ url });
      } catch (err) {
            console.error("Error in getFile:", err);
            return res.status(500).json({ message: "حدث خطأ", error: err.message });
      }
}

module.exports = { getFile };
