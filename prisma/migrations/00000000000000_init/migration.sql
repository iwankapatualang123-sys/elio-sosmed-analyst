-- CreateTable
CREATE TABLE `profiles` (
    `id` CHAR(36) NOT NULL,
    `full_name` TEXT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `role` ENUM('admin', 'manager', 'staff') NOT NULL DEFAULT 'staff',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` CHAR(36) NULL,

    UNIQUE INDEX `profiles_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tiktok_accounts` (
    `id` CHAR(36) NOT NULL,
    `nama_cabang` TEXT NOT NULL,
    `tiktok_username` VARCHAR(255) NOT NULL,
    `kategori` TEXT NULL,
    `logo_url` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` CHAR(36) NULL,

    UNIQUE INDEX `tiktok_accounts_tiktok_username_key`(`tiktok_username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_branch_access` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `tiktok_account_id` CHAR(36) NOT NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assigned_by` CHAR(36) NULL,

    UNIQUE INDEX `user_branch_access_user_id_tiktok_account_id_key`(`user_id`, `tiktok_account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tiktok_content` (
    `id` CHAR(36) NOT NULL,
    `tiktok_account_id` CHAR(36) NOT NULL,
    `video_id` VARCHAR(255) NOT NULL,
    `video_title` TEXT NULL,
    `video_link` TEXT NULL,
    `post_date` DATE NULL,
    `total_likes` INTEGER NULL DEFAULT 0,
    `total_comments` INTEGER NULL DEFAULT 0,
    `total_shares` INTEGER NULL DEFAULT 0,
    `total_views` INTEGER NULL DEFAULT 0,
    `report_generated_date` DATE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tiktok_content_tiktok_account_id_video_id_key`(`tiktok_account_id`, `video_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tiktok_daily_overview` (
    `id` CHAR(36) NOT NULL,
    `tiktok_account_id` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `video_views` INTEGER NULL DEFAULT 0,
    `profile_views` INTEGER NULL DEFAULT 0,
    `likes` INTEGER NULL DEFAULT 0,
    `comments` INTEGER NULL DEFAULT 0,
    `shares` INTEGER NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tiktok_daily_overview_tiktok_account_id_date_key`(`tiktok_account_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tiktok_follower_history` (
    `id` CHAR(36) NOT NULL,
    `tiktok_account_id` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `followers` INTEGER NOT NULL,
    `diff_from_previous_day` INTEGER NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tiktok_follower_history_tiktok_account_id_date_key`(`tiktok_account_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tiktok_follower_gender` (
    `id` CHAR(36) NOT NULL,
    `tiktok_account_id` CHAR(36) NOT NULL,
    `snapshot_date` DATE NOT NULL,
    `male_pct` DECIMAL(6, 3) NULL,
    `female_pct` DECIMAL(6, 3) NULL,
    `other_pct` DECIMAL(6, 3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tiktok_follower_gender_tiktok_account_id_snapshot_date_key`(`tiktok_account_id`, `snapshot_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tiktok_follower_territories` (
    `id` CHAR(36) NOT NULL,
    `tiktok_account_id` CHAR(36) NOT NULL,
    `snapshot_date` DATE NOT NULL,
    `territory_code` VARCHAR(255) NOT NULL,
    `distribution_pct` DECIMAL(6, 3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tiktok_follower_territories_tiktok_account_id_snapshot_date__key`(`tiktok_account_id`, `snapshot_date`, `territory_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tiktok_follower_activity` (
    `id` CHAR(36) NOT NULL,
    `tiktok_account_id` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `hour` SMALLINT NOT NULL,
    `active_followers` INTEGER NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tiktok_follower_activity_tiktok_account_id_date_hour_key`(`tiktok_account_id`, `date`, `hour`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tiktok_viewers` (
    `id` CHAR(36) NOT NULL,
    `tiktok_account_id` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `total_viewers` INTEGER NULL,
    `new_viewers` INTEGER NULL,
    `returning_viewers` INTEGER NULL,
    `is_incomplete` BOOLEAN NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tiktok_viewers_tiktok_account_id_date_key`(`tiktok_account_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` CHAR(36) NULL,
    `user_email` VARCHAR(255) NULL,
    `action` TEXT NOT NULL,
    `entity` TEXT NULL,
    `detail` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tiktok_account_goals` (
    `tiktok_account_id` CHAR(36) NOT NULL,
    `platform` VARCHAR(20) NOT NULL DEFAULT 'tiktok',
    `target_month` VARCHAR(7) NOT NULL,
    `target_total_views` INTEGER NULL,
    `target_engagement_rate` DECIMAL(6, 3) NULL,
    `target_net_followers` INTEGER NULL,
    `updated_by` CHAR(36) NULL,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`tiktok_account_id`, `platform`, `target_month`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branch_annotations` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tiktok_account_id` CHAR(36) NOT NULL,
    `note_date` DATE NOT NULL,
    `note` TEXT NOT NULL,
    `created_by` CHAR(36) NULL,
    `created_by_email` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `branch_annotations_tiktok_account_id_idx`(`tiktok_account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_plans` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tiktok_account_id` CHAR(36) NOT NULL,
    `plan_month` DATE NOT NULL,
    `post_date` DATE NULL,
    `seq` INTEGER NULL,
    `pic` TEXT NULL,
    `headline` TEXT NULL,
    `topic` TEXT NULL,
    `goals_content` TEXT NULL,
    `primary_pillar` TEXT NULL,
    `secondary_pillar` TEXT NULL,
    `content_type` TEXT NULL,
    `reference_url` TEXT NULL,
    `notes` TEXT NULL,
    `acc_to_posting` BOOLEAN NOT NULL DEFAULT false,
    `status_override` TEXT NULL,
    `created_by` CHAR(36) NULL,
    `created_by_email` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `posted_url` TEXT NULL,
    `replaced_by_id` BIGINT NULL,
    `platforms` JSON NOT NULL,
    `platform_links` JSON NOT NULL,

    INDEX `content_plans_tiktok_account_id_idx`(`tiktok_account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_plan_categories` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `category_type` VARCHAR(20) NOT NULL,
    `value` TEXT NOT NULL,
    `created_by` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `content_plan_categories_category_type_value_key`(`category_type`, `value`(191)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_account_snapshots` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tiktok_account_id` CHAR(36) NOT NULL,
    `platform` VARCHAR(20) NOT NULL,
    `snapshot_date` DATE NOT NULL,
    `followers` INTEGER NULL,
    `reach_30d` INTEGER NULL,
    `profile_visits` INTEGER NULL,
    `created_by` CHAR(36) NULL,
    `created_by_email` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `social_account_snapshots_tiktok_account_id_idx`(`tiktok_account_id`),
    UNIQUE INDEX `social_account_snapshots_tiktok_account_id_platform_snapshot_key`(`tiktok_account_id`, `platform`, `snapshot_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `instagram_daily_metrics` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tiktok_account_id` CHAR(36) NOT NULL,
    `metric` VARCHAR(30) NOT NULL,
    `date` DATE NOT NULL,
    `value` INTEGER NOT NULL,
    `created_by` CHAR(36) NULL,
    `created_by_email` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `instagram_daily_metrics_tiktok_account_id_idx`(`tiktok_account_id`),
    UNIQUE INDEX `instagram_daily_metrics_tiktok_account_id_metric_date_key`(`tiktok_account_id`, `metric`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `instagram_content` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tiktok_account_id` CHAR(36) NOT NULL,
    `post_id` VARCHAR(255) NOT NULL,
    `ig_account_id` VARCHAR(255) NULL,
    `username` VARCHAR(255) NULL,
    `account_name` TEXT NULL,
    `description` TEXT NULL,
    `duration_s` INTEGER NULL,
    `published_at` DATETIME(3) NULL,
    `permalink` TEXT NULL,
    `post_type` VARCHAR(50) NULL,
    `views` INTEGER NULL,
    `reach` INTEGER NULL,
    `likes` INTEGER NULL,
    `comments` INTEGER NULL,
    `shares` INTEGER NULL,
    `saves` INTEGER NULL,
    `profile_visits` INTEGER NULL,
    `replies` INTEGER NULL,
    `navigation` INTEGER NULL,
    `sticker_taps` INTEGER NULL,
    `follows` INTEGER NULL,
    `is_collab` BOOLEAN NOT NULL DEFAULT false,
    `created_by` CHAR(36) NULL,
    `created_by_email` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `instagram_content_tiktok_account_id_idx`(`tiktok_account_id`),
    UNIQUE INDEX `instagram_content_tiktok_account_id_post_id_key`(`tiktok_account_id`, `post_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tiktok_accounts` ADD CONSTRAINT `tiktok_accounts_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_branch_access` ADD CONSTRAINT `user_branch_access_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_branch_access` ADD CONSTRAINT `user_branch_access_assigned_by_fkey` FOREIGN KEY (`assigned_by`) REFERENCES `profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_branch_access` ADD CONSTRAINT `user_branch_access_tiktok_account_id_fkey` FOREIGN KEY (`tiktok_account_id`) REFERENCES `tiktok_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tiktok_content` ADD CONSTRAINT `tiktok_content_tiktok_account_id_fkey` FOREIGN KEY (`tiktok_account_id`) REFERENCES `tiktok_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tiktok_daily_overview` ADD CONSTRAINT `tiktok_daily_overview_tiktok_account_id_fkey` FOREIGN KEY (`tiktok_account_id`) REFERENCES `tiktok_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tiktok_follower_history` ADD CONSTRAINT `tiktok_follower_history_tiktok_account_id_fkey` FOREIGN KEY (`tiktok_account_id`) REFERENCES `tiktok_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tiktok_follower_gender` ADD CONSTRAINT `tiktok_follower_gender_tiktok_account_id_fkey` FOREIGN KEY (`tiktok_account_id`) REFERENCES `tiktok_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tiktok_follower_territories` ADD CONSTRAINT `tiktok_follower_territories_tiktok_account_id_fkey` FOREIGN KEY (`tiktok_account_id`) REFERENCES `tiktok_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tiktok_follower_activity` ADD CONSTRAINT `tiktok_follower_activity_tiktok_account_id_fkey` FOREIGN KEY (`tiktok_account_id`) REFERENCES `tiktok_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tiktok_viewers` ADD CONSTRAINT `tiktok_viewers_tiktok_account_id_fkey` FOREIGN KEY (`tiktok_account_id`) REFERENCES `tiktok_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tiktok_account_goals` ADD CONSTRAINT `tiktok_account_goals_tiktok_account_id_fkey` FOREIGN KEY (`tiktok_account_id`) REFERENCES `tiktok_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branch_annotations` ADD CONSTRAINT `branch_annotations_tiktok_account_id_fkey` FOREIGN KEY (`tiktok_account_id`) REFERENCES `tiktok_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_plans` ADD CONSTRAINT `content_plans_tiktok_account_id_fkey` FOREIGN KEY (`tiktok_account_id`) REFERENCES `tiktok_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_plans` ADD CONSTRAINT `content_plans_replaced_by_id_fkey` FOREIGN KEY (`replaced_by_id`) REFERENCES `content_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_account_snapshots` ADD CONSTRAINT `social_account_snapshots_tiktok_account_id_fkey` FOREIGN KEY (`tiktok_account_id`) REFERENCES `tiktok_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `instagram_daily_metrics` ADD CONSTRAINT `instagram_daily_metrics_tiktok_account_id_fkey` FOREIGN KEY (`tiktok_account_id`) REFERENCES `tiktok_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `instagram_content` ADD CONSTRAINT `instagram_content_tiktok_account_id_fkey` FOREIGN KEY (`tiktok_account_id`) REFERENCES `tiktok_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

