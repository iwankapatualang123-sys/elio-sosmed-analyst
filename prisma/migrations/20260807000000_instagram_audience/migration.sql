-- CreateTable
CREATE TABLE `instagram_audience` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tiktok_account_id` CHAR(36) NOT NULL,
    `snapshot_date` DATE NOT NULL,
    `followers` INTEGER NULL,
    `female_pct` DECIMAL(6, 3) NULL,
    `male_pct` DECIMAL(6, 3) NULL,
    `age_json` JSON NULL,
    `cities_json` JSON NULL,
    `countries_json` JSON NULL,
    `created_by` CHAR(36) NULL,
    `created_by_email` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `instagram_audience_tiktok_account_id_idx`(`tiktok_account_id`),
    UNIQUE INDEX `instagram_audience_tiktok_account_id_snapshot_date_key`(`tiktok_account_id`, `snapshot_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `instagram_audience` ADD CONSTRAINT `instagram_audience_tiktok_account_id_fkey` FOREIGN KEY (`tiktok_account_id`) REFERENCES `tiktok_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
