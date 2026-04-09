CREATE TABLE `profit_alert_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`minProfitRate` decimal(8,6) NOT NULL DEFAULT '0.100000',
	`enabled` int NOT NULL DEFAULT 1,
	`updatedById` int NOT NULL,
	`updatedByName` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `profit_alert_settings_id` PRIMARY KEY(`id`)
);
