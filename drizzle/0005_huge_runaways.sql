CREATE TABLE `exchange_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rate` decimal(10,4) NOT NULL,
	`previousRate` decimal(10,4),
	`changedById` int NOT NULL,
	`changedByName` varchar(128),
	`reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exchange_rates_id` PRIMARY KEY(`id`)
);
