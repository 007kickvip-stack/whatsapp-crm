CREATE TABLE `order_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`paymentType` varchar(32) NOT NULL DEFAULT '全款',
	`amount` decimal(12,2) NOT NULL DEFAULT '0',
	`screenshotUrl` text,
	`paymentDate` date,
	`receivingAccount` varchar(128),
	`remarks` text,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_payments_id` PRIMARY KEY(`id`)
);
