-- AlterTable
ALTER TABLE "public"."Users" ADD COLUMN     "address" TEXT,
ADD COLUMN     "birth_date" TIMESTAMP(3),
ADD COLUMN     "blood" TEXT,
ADD COLUMN     "emergency_number" TEXT;
