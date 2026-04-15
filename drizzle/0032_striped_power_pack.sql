CREATE TABLE `commission_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`minAmount` decimal(12,2) NOT NULL DEFAULT '0',
	`maxAmount` decimal(12,2),
	`commissionRate` decimal(8,4) NOT NULL DEFAULT '0',
	`sortOrder` int DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`createdById` int,
	`createdByName` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commission_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `baseSalary` decimal(12,2) DEFAULT '0';