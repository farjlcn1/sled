-- Odstrani številko vozniškega dovoljenja
ALTER TABLE "drivers" DROP COLUMN "licenseNumber";

-- Zamenjaj DriverIdMethod {IBUTTON, RFID, MANUAL} z {RFID_1356MHZ, RFID_125KHZ, IBUTTON}
ALTER TYPE "DriverIdMethod" RENAME TO "DriverIdMethod_old";

CREATE TYPE "DriverIdMethod" AS ENUM ('RFID_1356MHZ', 'RFID_125KHZ', 'IBUTTON');

ALTER TABLE "drivers" ALTER COLUMN "idMethod" DROP DEFAULT;

ALTER TABLE "drivers" ALTER COLUMN "idMethod" TYPE "DriverIdMethod" USING (
  CASE "idMethod"::text
    WHEN 'IBUTTON' THEN 'IBUTTON'
    ELSE 'RFID_1356MHZ'
  END
)::"DriverIdMethod";

ALTER TABLE "drivers" ALTER COLUMN "idMethod" SET DEFAULT 'RFID_1356MHZ';

DROP TYPE "DriverIdMethod_old";
