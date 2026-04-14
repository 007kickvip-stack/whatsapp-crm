CREATE TABLE `quotation_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quotationId` int NOT NULL,
	`orderImageUrl` text,
	`productName` varchar(255),
	`size` varchar(64),
	`quantity` int DEFAULT 1,
	`amountUsd` decimal(12,2) DEFAULT '0',
	`amountCny` decimal(12,2) DEFAULT '0',
	`remarks` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotation_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerName` varchar(128) NOT NULL,
	`contactInfo` text,
	`totalAmountUsd` decimal(12,2) DEFAULT '0',
	`totalAmountCny` decimal(12,2) DEFAULT '0',
	`status` varchar(32) DEFAULT '待确认',
	`remarks` text,
	`staffId` int,
	`staffName` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotations_id` PRIMARY KEY(`id`)
);
