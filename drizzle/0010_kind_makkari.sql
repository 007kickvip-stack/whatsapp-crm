CREATE TABLE `daily_report_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportDate` date NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(128) NOT NULL,
	`userRole` varchar(32) NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_report_notes_id` PRIMARY KEY(`id`)
);
