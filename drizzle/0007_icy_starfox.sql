CREATE TABLE `staff_monthly_targets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffId` int NOT NULL,
	`staffName` varchar(128) NOT NULL,
	`yearMonth` varchar(7) NOT NULL,
	`profitTarget` decimal(12,2) NOT NULL DEFAULT '0',
	`revenueTarget` decimal(12,2) NOT NULL DEFAULT '0',
	`setById` int NOT NULL,
	`setByName` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_monthly_targets_id` PRIMARY KEY(`id`)
);
