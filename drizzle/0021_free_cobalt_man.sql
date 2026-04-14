CREATE TABLE `paypal_expense` (
	`id` int AUTO_INCREMENT NOT NULL,
	`expenseDate` date,
	`account` varchar(64),
	`amount` decimal(12,2) DEFAULT '0',
	`remarks` text,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paypal_expense_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paypal_income` (
	`id` int AUTO_INCREMENT NOT NULL,
	`incomeDate` date,
	`account` varchar(64),
	`customerWhatsapp` varchar(255),
	`paymentScreenshotUrl` text,
	`paymentAmount` decimal(12,2) DEFAULT '0',
	`actualReceived` decimal(12,2) DEFAULT '0',
	`isReceived` varchar(32) DEFAULT '否',
	`receivingAccount` varchar(128),
	`staffName` varchar(64),
	`remarks` text,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paypal_income_id` PRIMARY KEY(`id`)
);
