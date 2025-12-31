-- ✅ Migration: إضافة الحقول المطلوبة لجدول reports لتخزين تقارير الأطباء
-- يجب تشغيل هذا السكريبت على قاعدة البيانات

-- إضافة الحقول الجديدة لجدول reports
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS "appointmentId" INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS "doctorId" INTEGER,
ADD COLUMN IF NOT EXISTS "caseName" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "phone" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "nationalId" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "testName" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "files" JSONB,
ADD COLUMN IF NOT EXISTS "report" TEXT,
ADD COLUMN IF NOT EXISTS "nextAction" TEXT,
ADD COLUMN IF NOT EXISTS "sessionCost" NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS "medicalCenterId" INTEGER;

-- إضافة فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_reports_appointment_id ON reports("appointmentId");
CREATE INDEX IF NOT EXISTS idx_reports_doctor_id ON reports("doctorId");
CREATE INDEX IF NOT EXISTS idx_reports_national_id ON reports("nationalId");
CREATE INDEX IF NOT EXISTS idx_reports_medical_center_id ON reports("medicalCenterId");

-- ملاحظة: الحقول الموجودة مسبقاً في reports:
-- id, userId, reportText, chronicDisease, chronicDiseaseName, medications, radiology, labTests, createdAt

