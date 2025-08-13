-- CreateTable
CREATE TABLE "public"."Result" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "result" TEXT,
    "reportId" INTEGER NOT NULL,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Result" ADD CONSTRAINT "Result_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."Reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
