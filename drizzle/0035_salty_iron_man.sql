CREATE TABLE `salary_adjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffId` int NOT NULL,
	`yearMonth` varchar(7) NOT NULL,
	`profitDeduction` decimal(12,2) DEFAULT '0',
	`bonus` decimal(12,2) DEFAULT '0',
	`onlineCommission` decimal(12,2) DEFAULT '0',
	`performanceDeduction` decimal(12,2) DEFAULT '0',
	`remark` text,
	`createdById` int,
	`createdByName` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salary_adjustments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `completionStatus` varchar(32) DEFAULT '未完成';