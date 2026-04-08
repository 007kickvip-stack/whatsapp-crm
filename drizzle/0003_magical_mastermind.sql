CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(128),
	`userRole` varchar(32),
	`action` varchar(64) NOT NULL,
	`targetType` varchar(64) NOT NULL,
	`targetId` int,
	`targetName` varchar(255),
	`details` text,
	`ipAddress` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
