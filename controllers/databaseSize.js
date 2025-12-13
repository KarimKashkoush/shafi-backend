import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import { CloudWatchClient, GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";

const rds = new RDSClient({ region: "eu-north-1" });
const cloudwatch = new CloudWatchClient({ region: "eu-north-1" });

export const getRDSUsage = async (req, res) => {
      try {
            const DBInstanceIdentifier = "shafi-db";

            // 1) Get Allocated Storage (المساحة الكاملة)
            const describeCmd = new DescribeDBInstancesCommand({
                  DBInstanceIdentifier
            });

            const describeRes = await rds.send(describeCmd);
            const db = describeRes.DBInstances[0];

            const allocatedGB = db.AllocatedStorage; // إجمالي التخزين بالـ GB
            const storageType = db.StorageType;      // gp2 / gp3
            const dbStatus = db.DBInstanceStatus;    // available / modifying...

            // 2) Get Free Storage From CloudWatch
            const cloudCmd = new GetMetricStatisticsCommand({
                  Namespace: "AWS/RDS",
                  MetricName: "FreeStorageSpace",
                  Dimensions: [{ Name: "DBInstanceIdentifier", Value: DBInstanceIdentifier }],
                  Period: 3600,
                  StartTime: new Date(Date.now() - 3600 * 1000),
                  EndTime: new Date(),
                  Statistics: ["Average"]
            });

            const cloudRes = await cloudwatch.send(cloudCmd);
            const freeBytes = cloudRes.Datapoints?.[0]?.Average || 0;

            const freeGB = (freeBytes / (1024 ** 3)).toFixed(2);
            const usedGB = (allocatedGB - freeGB).toFixed(2);

            res.json({
                  message: "success",
                  DBInstanceIdentifier,
                  allocatedGB,
                  freeGB,
                  usedGB,
                  storageType,
                  dbStatus
            });

      } catch (error) {
            console.error("❌ Error:", error);
            res.status(500).json({ message: "error", error: error.message });
      }
};
