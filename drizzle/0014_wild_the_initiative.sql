ALTER TABLE `customers` ADD `staffName` varchar(64);--> statement-breakpoint
ALTER TABLE `customers` ADD `account` varchar(64);--> statement-breakpoint
ALTER TABLE `customers` ADD `contactInfo` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `totalOrderCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `customers` ADD `totalSpentUsd` decimal(12,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `customers` ADD `totalSpentCny` decimal(12,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `customers` ADD `firstOrderDate` date;--> statement-breakpoint
ALTER TABLE `customers` ADD `customerLevel` varchar(32);--> statement-breakpoint
ALTER TABLE `customers` ADD `orderCategory` varchar(255);--> statement-breakpoint
ALTER TABLE `customers` ADD `customerName` varchar(128);--> statement-breakpoint
ALTER TABLE `customers` ADD `birthDate` date;--> statement-breakpoint
ALTER TABLE `customers` ADD `customerEmail` varchar(320);