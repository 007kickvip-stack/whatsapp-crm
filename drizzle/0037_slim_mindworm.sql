CREATE TABLE `annual_targets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`type` varchar(20) NOT NULL,
	`staffId` int,
	`staffName` varchar(128),
	`profitTarget` decimal(14,2) NOT NULL DEFAULT '0',
	`revenueTarget` decimal(14,2) NOT NULL DEFAULT '0',
	`setById` int NOT NULL,
	`setByName` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `annual_targets_id` PRIMARY KEY(`id`)
);
