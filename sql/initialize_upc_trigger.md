Instructions for creating a UPC column
1️⃣ Add upc Column
```
ALTER TABLE pricelist
ADD COLUMN upc VARCHAR(12);
```

2️⃣ Create AFTER INSERT Trigger
```
DELIMITER $$

CREATE TRIGGER after_pricelist_insert
AFTER INSERT ON pricelist
FOR EACH ROW
BEGIN
    UPDATE pricelist
    SET upc = CONCAT('999999', LPAD(NEW.id, 5, '0'), '0')
    WHERE id = NEW.id;
END$$

DELIMITER ;
```

3️⃣ (Optional) Create AFTER UPDATE Trigger
This ensures if anything ever modifies the id (unlikely), the UPC stays in sync.

```
DELIMITER $$

CREATE TRIGGER after_pricelist_update
AFTER UPDATE ON pricelist
FOR EACH ROW
BEGIN
    UPDATE pricelist
    SET upc = CONCAT('999999', LPAD(NEW.id, 5, '0'), '0')
    WHERE id = NEW.id;
END$$

DELIMITER ;
```

4️⃣ Backfill Existing UPCs
For products already in your pricelist:

```
UPDATE pricelist
SET upc = CONCAT('999999', LPAD(id, 5, '0'), '0')
WHERE upc IS NULL OR upc = '';
```
