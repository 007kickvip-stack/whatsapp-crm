CREATE TABLE `social_insurance_costs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`yearMonth` varchar(7) NOT NULL,
	`amount` decimal(12,2) NOT NULL DEFAULT '0',
	`remark` text,
	`createdById` int,
	`createdByName` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `social_insurance_costs_id` PRIMARY KEY(`id`),
	CONSTRAINT `social_insurance_costs_yearMonth_unique` UNIQUE(`yearMonth`)
);
